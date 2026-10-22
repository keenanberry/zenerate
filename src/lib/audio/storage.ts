import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { GenerationMeta } from "@/lib/meditation/types";

const BUCKET = "meditation-audio";

/**
 * Service-role Supabase client that bypasses RLS.
 * Only use server-side for storage operations.
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Where one render's audio lives: `<user_id>/<meditation_id>/<render_id>.mp3`.
 * One folder per user, so deleting someone's audio is removing their prefix;
 * one folder per meditation, so deleting a meditation is removing its folder;
 * and a new name per render, so a render never overwrites audio that a
 * version (or an already-minted signed URL) still points at.
 */
export function renderAudioPath(userId: string, meditationId: string, renderId: string): string {
  return `${meditationFolder(userId, meditationId)}/${renderId}.mp3`;
}

export function meditationFolder(userId: string, meditationId: string): string {
  return `${userId}/${meditationId}`;
}

/**
 * Upload an MP3 buffer to Supabase Storage and return its storage PATH.
 *
 * Deliberately not a URL: a signed URL is a bearer token that bypasses
 * is_public and RLS, and one with a useful lifetime eventually expires.
 * Sign at read time with hydrateAudioUrl / hydrateAudioUrls instead
 * (see src/lib/audio/signed-url.ts).
 *
 * Never upserts. The render id is fresh on every call, including a step
 * retry, so a retry writes a new file rather than failing on the old name.
 */
export async function uploadAudio(
  userId: string,
  meditationId: string,
  audioBuffer: Buffer,
): Promise<string> {
  const supabase = createServiceClient();
  const filePath = renderAudioPath(userId, meditationId, randomUUID());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  return filePath;
}

/**
 * Remove audio objects. Storage does not cascade from the database, so
 * whatever deletes a row that points at audio calls this too. Removing a
 * path that is already gone is not an error.
 */
export async function removeAudio(paths: Array<string | null | undefined>): Promise<void> {
  const present = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (present.length === 0) return;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove(present);
  if (error) {
    throw new Error(`Storage remove failed: ${error.message}`);
  }
}

/**
 * Remove every object in a meditation's folder, plus any `extraPaths` that
 * live outside it (audio from before the per-user layout sat at the bucket
 * root as `<meditation_id>.mp3`).
 */
export async function removeMeditationAudio(
  userId: string,
  meditationId: string,
  extraPaths: Array<string | null | undefined> = [],
): Promise<void> {
  const supabase = createServiceClient();
  const folder = meditationFolder(userId, meditationId);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 1000 });
  if (error) {
    throw new Error(`Storage list failed: ${error.message}`);
  }

  await removeAudio([...(data ?? []).map((o) => `${folder}/${o.name}`), ...extraPaths]);
}

/**
 * Update a meditation record's status and optional audio_path / generation_meta.
 */
export async function updateMeditationStatus(
  meditationId: string,
  status: string,
  audioPath?: string,
  generationMeta?: GenerationMeta,
): Promise<void> {
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (audioPath !== undefined) {
    update.audio_path = audioPath;
  }
  if (generationMeta !== undefined) {
    update.generation_meta = generationMeta;
  }

  const { error } = await supabase
    .from("meditations")
    .update(update)
    .eq("id", meditationId);

  if (error) {
    throw new Error(`Status update failed: ${error.message}`);
  }
}
