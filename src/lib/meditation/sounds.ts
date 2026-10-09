/**
 * Every sound effect a script can reference, with its length in seconds.
 *
 * The single source of truth for three consumers that must agree: the script
 * prompt (what the model may name), the duration estimate, and
 * scripts/sound-effects.ts (what the snapshot build puts in /sounds). A test
 * holds them in step -- a marker for a missing file plays as 1s of silence.
 */
export const SOUND_EFFECTS = {
  "gong-gentle.mp3": 4,
  "gong-deep.mp3": 12,
  "bell-tibetan.mp3": 7,
  "bell-crystal.mp3": 5,
  "chime-soft.mp3": 4,
  "bowls-singing.mp3": 10,
} as const;

/** What generate-audio.ts substitutes for a sound file that does not exist. */
export const MISSING_SOUND_SECONDS = 1;

export function soundSeconds(file: string): number {
  return (SOUND_EFFECTS as Record<string, number>)[file] ?? MISSING_SOUND_SECONDS;
}
