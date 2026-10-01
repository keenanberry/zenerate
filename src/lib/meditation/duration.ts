import { parseMeditationText } from "./parser";

/**
 * Estimate how long a meditation script will actually run.
 *
 * A meditation's length is dominated by silence, not words: `*[SILENCE: 20
 * minutes]*` costs about eight tokens and buys twenty minutes. That makes the
 * estimate unusually trustworthy -- pauses and silences are exact, and only
 * the speech portion is approximate. Across the seeded scripts speech accounts
 * for roughly 10-25% of total runtime, so even a sizeable error in the speech
 * rate moves the total very little.
 */

/**
 * ElevenLabs narrates at roughly 150 wpm, and `generate-audio.ts` requests
 * `speed: 0.85`, so the effective rate is ~128 wpm.
 *
 * This is a derived estimate, NOT a measurement. Calibrate it against a real
 * generation -- time the narration of a known script and divide -- before
 * relying on it for anything tighter than the +/-20% band below.
 */
const BASE_WORDS_PER_MINUTE = 150;
const TTS_SPEED = 0.85;
export const EFFECTIVE_WORDS_PER_MINUTE = BASE_WORDS_PER_MINUTE * TTS_SPEED;

/**
 * How far from the requested duration is acceptable before we say something.
 * Wide on purpose: the speech rate is an estimate, and meditation length is
 * not a precision instrument. This exists to catch a script that is half the
 * requested length, not one that is 8% off.
 */
export const DURATION_TOLERANCE = 0.2;

export type DurationEstimate = {
  /** Spoken words, converted at the effective TTS rate. */
  speechSeconds: number;
  /** Sum of `*[PAUSE: N seconds]*`. Exact. */
  pauseSeconds: number;
  /** Sum of `*[SILENCE: N minutes]*`. Exact. */
  silenceSeconds: number;
  totalSeconds: number;
  /** Share of runtime that is narration, 0-1. Low is good for long sessions. */
  speechRatio: number;
};

export function estimateDuration(script: string): DurationEstimate {
  const segments = parseMeditationText(script);

  let words = 0;
  let pauseSeconds = 0;
  let silenceSeconds = 0;

  for (const segment of segments) {
    if (segment.type === "speech") {
      const trimmed = segment.content.trim();
      if (trimmed) words += trimmed.split(/\s+/).length;
    } else if (segment.type === "pause") {
      pauseSeconds += segment.duration;
    } else if (segment.type === "silence") {
      silenceSeconds += segment.duration;
    }
  }

  const speechSeconds = Math.round((words / EFFECTIVE_WORDS_PER_MINUTE) * 60);
  const totalSeconds = speechSeconds + pauseSeconds + silenceSeconds;

  return {
    speechSeconds,
    pauseSeconds,
    silenceSeconds,
    totalSeconds,
    speechRatio: totalSeconds > 0 ? speechSeconds / totalSeconds : 0,
  };
}

export type DurationCheck = DurationEstimate & {
  targetSeconds: number;
  /** totalSeconds / targetSeconds. 1 is exact; 0.6 means 40% short. */
  ratio: number;
  withinTolerance: boolean;
};

export function checkDuration(
  script: string,
  targetMinutes: number,
): DurationCheck {
  const estimate = estimateDuration(script);
  const targetSeconds = targetMinutes * 60;
  const ratio = targetSeconds > 0 ? estimate.totalSeconds / targetSeconds : 0;

  return {
    ...estimate,
    targetSeconds,
    ratio,
    withinTolerance: Math.abs(ratio - 1) <= DURATION_TOLERANCE,
  };
}

/** "12 min 11 sec", for user-facing copy. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}
