/**
 * The voices meditations may be narrated in: the operator's ElevenLabs
 * collection. Pure and secret-free so client components can import the
 * default; fetching lives in ./server.ts.
 */

/** The "Zenerate" collection in the operator's ElevenLabs account. */
export const VOICE_COLLECTION_ID = "AiiDoM0Zo7GFsRZ13gbN";

/** Brittney -- Relaxing, Calm and Meditative. Must be in the collection. */
export const DEFAULT_VOICE_ID = "pjcYQlDFKMbcOUp6F5GD";

export interface Voice {
  voiceId: string;
  name: string;
  description: string;
  gender: string;
  previewUrl: string | null;
}

/** The fields this module reads from ElevenLabs' `GET /v2/voices`. */
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: { gender?: string } | null;
  preview_url?: string | null;
  collection_ids?: string[] | null;
}

/**
 * Library voices are titled "Name - Description". Only a spaced dash
 * separates, so a hyphenated name survives.
 */
export function parseVoiceTitle(title: string): { name: string; description: string } {
  const match = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!match) return { name: title.trim(), description: "" };
  return { name: match[1].trim(), description: match[2].trim() };
}

/** Collection voices, default first, then by name. */
export function toVoiceCatalog(voices: ElevenLabsVoice[]): Voice[] {
  return voices
    .filter((v) => v.collection_ids?.includes(VOICE_COLLECTION_ID))
    .map((v) => ({
      voiceId: v.voice_id,
      ...parseVoiceTitle(v.name),
      gender: v.labels?.gender ?? "unknown",
      previewUrl: v.preview_url ?? null,
    }))
    .sort((a, b) => {
      if (a.voiceId === DEFAULT_VOICE_ID) return -1;
      if (b.voiceId === DEFAULT_VOICE_ID) return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Validate the voice a request asks for. Absent means no override: the
 * workflow then uses the voice saved on the meditation, else the default.
 * Anything present must be in the collection, or any ElevenLabs library
 * voice could be requested.
 */
export function resolveVoiceId(
  requested: unknown,
  allowed: Set<string>,
): { ok: true; voiceId: string | null } | { ok: false } {
  if (requested === undefined || requested === null) {
    return { ok: true, voiceId: null };
  }
  if (typeof requested === "string" && allowed.has(requested)) {
    return { ok: true, voiceId: requested };
  }
  return { ok: false };
}
