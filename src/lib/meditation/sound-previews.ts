import { SOUND_EFFECTS } from "./sounds";

/**
 * Browser-playable copies of the sound effects, for the chat's preview card.
 * The files in public/sounds/ come from scripts/export-sound-previews.ts and
 * are committed; a test checks every catalog entry has one. Nothing here is
 * in the sandbox snapshot.
 */
export type SoundName = keyof typeof SOUND_EFFECTS;

export const SOUND_NAMES = Object.keys(SOUND_EFFECTS) as [SoundName, ...SoundName[]];

/** What a person hears the sound called. Keyed by the catalog, so a new sound fails typecheck here. */
export const SOUND_LABELS: Record<SoundName, string> = {
  "gong-gentle.mp3": "Gentle gong",
  "gong-deep.mp3": "Deep gong",
  "bell-tibetan.mp3": "Tibetan bell",
  "bell-crystal.mp3": "Crystal bell",
  "chime-soft.mp3": "Soft chime",
  "bowls-singing.mp3": "Singing bowl",
};

export interface SoundPreview {
  name: SoundName;
  label: string;
  url: string;
  seconds: number;
}

export function soundPreviewUrl(name: SoundName): string {
  return `/sounds/${name}`;
}

export function soundPreview(name: SoundName): SoundPreview {
  return { name, label: SOUND_LABELS[name], url: soundPreviewUrl(name), seconds: SOUND_EFFECTS[name] };
}
