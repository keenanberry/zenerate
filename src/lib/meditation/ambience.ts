/**
 * The ambient beds a meditation can play under its narration, plus "none".
 *
 * The single source of truth for everything that names a bed: the Make audio
 * card's picker, the generate route's validation, the workflow (which hands
 * the snapshot path to generate-audio.ts as backgroundMusic), the agent's
 * offerAudio suggestion and scripts/ambient-beds.ts (what the snapshot build
 * puts in /sounds/ambient). Tests hold them in step.
 *
 * meditations.settings.music stores the id, not the path, so a bed can move
 * inside the snapshot without rewriting rows.
 */
export const AMBIENCE_IDS = [
  "none",
  "rain",
  "ocean",
  "forest",
  "drone",
  "space",
  "chant",
] as const;

export type AmbienceId = (typeof AMBIENCE_IDS)[number];

export interface Ambience {
  id: AmbienceId;
  label: string;
  /** Relative to the sandbox's working directory, like ./sounds. Null for none. */
  snapshotPath: string | null;
  /** Browser-playable copy under public/, for the card's play button. Null for none. */
  previewUrl: string | null;
  /**
   * Linear gain generate-audio.ts applies to the bed before ducking it under
   * the narration. The files are already quiet (scripts/ambient-beds.ts); this
   * sets each one's place under -20 LUFS narration, by ear in a test mix.
   */
  volume: number;
}

/** `file` is its name in the snapshot: an MP3, except where ambient-beds.ts renders it lossless. */
function bed(
  id: Exclude<AmbienceId, "none">,
  label: string,
  volume: number,
  file = `${id}.mp3`,
): Ambience {
  return {
    id,
    label,
    snapshotPath: `sounds/ambient/${file}`,
    previewUrl: `/sounds/ambient/${id}.mp3`,
    volume,
  };
}

export const AMBIENCES: Record<AmbienceId, Ambience> = {
  none: { id: "none", label: "None", snapshotPath: null, previewUrl: null, volume: 0 },
  rain: bed("rain", "Rain", 0.5),
  ocean: bed("ocean", "Ocean", 0.5),
  forest: bed("forest", "Forest", 0.5),
  drone: bed("drone", "Soft drone", 0.5),
  space: bed("space", "Space", 0.5, "space.flac"),
  chant: bed("chant", "Chant", 0.5),
};

export function isAmbienceId(value: unknown): value is AmbienceId {
  return typeof value === "string" && (AMBIENCE_IDS as readonly string[]).includes(value);
}

/**
 * The bed saved in settings.music, or null when there is none or it is not
 * one we know, such as a bed since retired: the meditation then renders with
 * narration alone and the card offers its default.
 */
export function savedAmbience(music: string | null | undefined): AmbienceId | null {
  return isAmbienceId(music) ? music : null;
}
