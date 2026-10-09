/**
 * Narration loudness normalization. Bundled into the sandbox snapshot via
 * generate-audio.ts -- an edit here needs a snapshot rebuild.
 *
 * ElevenLabs returns each voice at its own level: measured with production
 * settings, Vincent came out at -27.3 LUFS and Brittney at -33.6. Without
 * normalization a meditation's volume depends on the voice picked, and the
 * sound effects, which have fixed levels, sit louder against quiet voices.
 * Bringing all narration to one target is what lets the effects have a
 * single correct level.
 */

/** Calm spoken-word level; the sound effects were balanced by ear against it. */
export const NARRATION_TARGET_LUFS = -20;

const MAX_BOOST_DB = 20;
const MAX_CUT_DB = -20;

/** ebur128 reports this floor when nothing rises above its absolute gate. */
const GATING_FLOOR_LUFS = -70;

/**
 * Integrated loudness from `ffmpeg -af ebur128` stderr, or null if it is
 * missing or the input was effectively silent.
 */
export function parseIntegratedLoudness(stderr: string): number | null {
  // ffmpeg prints an empty summary while configuring the filter graph and the
  // real one at the end, so read the last.
  const blocks = stderr.split("Summary:");
  if (blocks.length < 2) return null;
  const summary = blocks[blocks.length - 1];

  const match = summary.match(/I:\s*(-?[\d.]+)\s*LUFS/);
  if (!match) return null;

  const lufs = Number(match[1]);
  if (!Number.isFinite(lufs) || lufs <= GATING_FLOOR_LUFS) return null;
  return lufs;
}

/**
 * Gain in dB that brings narration measured at `measuredLufs` to the target.
 * Unmeasurable narration is left alone rather than guessed at.
 */
export function narrationGainDb(measuredLufs: number | null): number {
  if (measuredLufs === null) return 0;
  const gain = NARRATION_TARGET_LUFS - measuredLufs;
  return Math.min(MAX_BOOST_DB, Math.max(MAX_CUT_DB, gain));
}
