import type { MeditationSegment } from "./types";
import { EFFECTIVE_WORDS_PER_MINUTE } from "./duration";
import { SOUND_EFFECTS, soundSeconds } from "./sounds";

/**
 * Where each script segment sits in the finished audio, for the script
 * viewer's follow-along.
 *
 * The audio pipeline concatenates one clip per segment in script order with
 * nothing in between, so the timeline is a running sum. Pauses, silences and
 * sounds have exact lengths; only speech is estimated, from its word count.
 * Once the real duration is known, the speech estimate is scaled so the
 * timeline ends where the audio does -- the error in the narration rate is
 * absorbed by the speech, the one part that was a guess.
 */

export type SegmentSpan = { start: number; end: number };

function speechWords(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function fixedSeconds(segment: MeditationSegment): number {
  switch (segment.type) {
    case "pause":
    case "silence":
      return segment.duration;
    case "sound":
      return soundSeconds(segment.file);
    case "speech":
      return 0;
  }
}

export function segmentSpans(
  segments: MeditationSegment[],
  audioSeconds?: number,
): SegmentSpan[] {
  const speechEstimate = segments.map((s) =>
    s.type === "speech"
      ? (speechWords(s.content) / EFFECTIVE_WORDS_PER_MINUTE) * 60
      : 0,
  );
  const totalSpeech = speechEstimate.reduce((a, b) => a + b, 0);
  const totalFixed = segments.reduce((a, s) => a + fixedSeconds(s), 0);

  let speechScale = 1;
  let fixedScale = 1;
  if (audioSeconds && Number.isFinite(audioSeconds) && audioSeconds > 0) {
    const room = audioSeconds - totalFixed;
    if (totalSpeech > 0 && room > 0) {
      speechScale = room / totalSpeech;
    } else if (totalFixed + totalSpeech > 0) {
      // No speech to absorb the difference, or audio shorter than its exact
      // parts: stretch everything evenly rather than give speech a negative
      // length.
      speechScale = fixedScale = audioSeconds / (totalFixed + totalSpeech);
    }
  }

  let cursor = 0;
  return segments.map((s, i) => {
    const length =
      s.type === "speech"
        ? speechEstimate[i] * speechScale
        : fixedSeconds(s) * fixedScale;
    const span = { start: cursor, end: cursor + length };
    cursor = span.end;
    return span;
  });
}

/** The segment playing at `time`, or -1 before the first and after the last. */
export function activeSegmentIndex(spans: SegmentSpan[], time: number): number {
  for (let i = 0; i < spans.length; i++) {
    if (time >= spans[i].start && time < spans[i].end) return i;
  }
  return -1;
}

export type LineState = "idle" | "upcoming" | "current" | "passed";

/**
 * How a segment reads during playback. `idle` until playback has started, so
 * a script nobody is listening to stays evenly lit.
 */
export function lineState(
  index: number,
  spans: SegmentSpan[],
  time: number,
  started: boolean,
): LineState {
  if (!started || !spans[index]) return "idle";
  const { start, end } = spans[index];
  if (time >= end) return "passed";
  if (time >= start) return "current";
  return "upcoming";
}

/**
 * A sound file as the script viewer names it: "gong-deep.mp3" reads as
 * "deep gong". A file outside the catalog is shown as written, since it plays
 * as silence and the author should see exactly what they typed.
 */
export function soundName(file: string): string {
  if (!(file in SOUND_EFFECTS)) return file;
  return file.replace(/\.mp3$/, "").split("-").reverse().join(" ");
}
