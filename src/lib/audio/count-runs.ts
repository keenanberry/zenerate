import type { MeditationSegment } from "@/lib/meditation/types";

/**
 * Count runs: a spoken count rendered as one ElevenLabs request.
 *
 * The studio writes a count the PR #161 way, one number a line with its own
 * PAUSE, and the stored script stays that way. Rendered as one request a
 * number, each beat had its own read: on 2026-11-23 every such render had one
 * number with an odd pitch, and one "One." came back silent. One request for
 * the whole count, with each PAUSE turned into a `<break>` of the same
 * seconds, held one voice and an even beat in every render, and the operator
 * chose it. Only the text sent to text-to-speech changes, so the script
 * viewer, the duration estimates and the follow-along timeline (all computed
 * from the stored script) are untouched, and the audio keeps the same pauses.
 *
 * Runs here, in the app, before config.json is written. The sandbox sends the
 * text as it is, so this needs no new snapshot.
 */

/** Fewest beats worth merging; two lines are as likely prose as a count. */
export const MIN_RUN_BEATS = 3;

/** ElevenLabs refuses a break over 3 s; a longer PAUSE ends the run. */
export const MAX_BREAK_SECONDS = 3;

/**
 * Per request. ElevenLabs shortens breaks once a request carries too much
 * break time; measured 2026-11-23 with eleven_multilingual_v2 (silence per
 * break, including ~0.3 s of word padding): 8 beats of 2 s held (2.3 s),
 * 10 beats of 2 s (18 s in all) held at ~2.0 s, 12 beats of 2 s came out at
 * 1.7 s, 20 at 0.95 s, and 8 beats of 3 s (21 s) at 2.75 s. A longer run is
 * split into requests within both limits, joined by their own PAUSE.
 */
export const MAX_RUN_BEATS = 10;
export const MAX_RUN_BREAK_SECONDS = 18;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

/**
 * The number a line counts, when the line is one beat of a count: one to
 * three words ("Ten.", "And nine…", "Breathe in, one."), exactly one of them a
 * number. Null for anything else.
 */
export function beatNumber(text: string): number | null {
  if (/[<>]/.test(text)) return null;
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length < 1 || words.length > 3) return null;
  const numbers = words
    .map((w) => (/^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w]))
    .filter((n): n is number => n !== undefined);
  return numbers.length === 1 ? numbers[0] : null;
}

/** The next beat of a count goes up or down by one, or starts again at one. */
function continuesCount(previous: number, next: number): boolean {
  return Math.abs(next - previous) === 1 || (next === 1 && previous !== 1);
}

type Beat = { content: string; pauseAfter?: number };

function mergedSpeech(beats: Beat[]): MeditationSegment {
  const content = beats
    .map((beat, i) =>
      i < beats.length - 1 ? `${beat.content} <break time="${beat.pauseAfter}s" />` : beat.content,
    )
    .join(" ");
  return { type: "speech", content };
}

/**
 * Splits a run into the fewest requests that keep within MAX_RUN_BEATS and
 * MAX_RUN_BREAK_SECONDS, as evenly as the beats allow.
 */
export function splitRun<T extends { pauseAfter?: number }>(beats: T[]): T[][] {
  for (let parts = Math.ceil(beats.length / MAX_RUN_BEATS); parts <= beats.length; parts++) {
    const chunks: T[][] = [];
    let start = 0;
    for (let p = 0; p < parts; p++) {
      const size = Math.floor(beats.length / parts) + (p < beats.length % parts ? 1 : 0);
      chunks.push(beats.slice(start, start + size));
      start += size;
    }
    const fits = chunks.every(
      (chunk) => chunk.slice(0, -1).reduce((sum, beat) => sum + (beat.pauseAfter ?? 0), 0) <= MAX_RUN_BREAK_SECONDS,
    );
    if (fits) return chunks;
  }
  return beats.map((beat) => [beat]);
}

/**
 * The segments to render, with each count run merged into one speech segment
 * per request. A run is MIN_RUN_BEATS or more beats (see beatNumber) counting
 * up, down or again from one, with only a PAUSE of 1 to MAX_BREAK_SECONDS
 * between each pair. The PAUSEs before and after a run stay as they are.
 */
export function mergeCountRuns(segments: MeditationSegment[]): MeditationSegment[] {
  const out: MeditationSegment[] = [];
  let i = 0;
  while (i < segments.length) {
    const first = segments[i];
    const firstNumber = first.type === "speech" ? beatNumber(first.content) : null;
    if (first.type !== "speech" || firstNumber === null) {
      out.push(first);
      i++;
      continue;
    }

    // Extend the run while the next two segments are a short PAUSE and a beat
    // that continues the count.
    const beats: Beat[] = [{ content: first.content }];
    let last = firstNumber;
    let j = i + 1;
    while (j + 1 < segments.length) {
      const pause = segments[j];
      const next = segments[j + 1];
      if (pause.type !== "pause" || pause.duration < 1 || pause.duration > MAX_BREAK_SECONDS) break;
      if (next.type !== "speech") break;
      const n = beatNumber(next.content);
      if (n === null || !continuesCount(last, n)) break;
      beats[beats.length - 1].pauseAfter = pause.duration;
      beats.push({ content: next.content });
      last = n;
      j += 2;
    }

    if (beats.length < MIN_RUN_BEATS) {
      out.push(first);
      i++;
      continue;
    }

    const chunks = splitRun(beats);
    chunks.forEach((chunk, c) => {
      out.push(chunk.length === 1 ? { type: "speech", content: chunk[0].content } : mergedSpeech(chunk));
      if (c < chunks.length - 1) {
        out.push({ type: "pause", duration: chunk[chunk.length - 1].pauseAfter! });
      }
    });
    i = j;
  }
  return out;
}
