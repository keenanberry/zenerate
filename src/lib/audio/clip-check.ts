/**
 * Near-silent speech clips. On 2026-11-23 ElevenLabs once returned a clip for
 * "One." whose loudest sample was -52 dBFS: a second of near silence, billed,
 * that would have gone into the meditation with nothing to show a word was
 * missing. Real narration peaks between about -28 and -12 dBFS before the
 * loudness gain, so a clip that never reaches -40 has no audible word in it.
 *
 * Kept free of ffmpeg so it can be unit-tested; it is bundled into the
 * sandbox snapshot with generate-audio.ts.
 */

export const NEAR_SILENT_PEAK_DB = -40;

/** The `max_volume` from ffmpeg's volumedetect filter, or null when absent. */
export function parseMaxVolume(stderr: string): number | null {
  const matches = [...stderr.matchAll(/max_volume:\s*(-?inf|-?\d+(?:\.\d+)?)\s*dB/g)];
  const last = matches.at(-1)?.[1];
  if (last === undefined) return null;
  if (last.endsWith("inf")) return last.startsWith("-") ? -Infinity : Infinity;
  return Number(last);
}

/**
 * Whether a speech clip came back without an audible word. A clip whose peak
 * could not be measured is given the benefit of the doubt: a failed
 * measurement should not fail a render.
 */
export function isNearSilent(peakDb: number | null): boolean {
  return peakDb !== null && peakDb < NEAR_SILENT_PEAK_DB;
}
