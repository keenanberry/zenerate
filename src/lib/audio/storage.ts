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
 * Upload an MP3 buffer to Supabase Storage and return its storage PATH.
 *
 * Deliberately not a URL: a signed URL is a bearer token that bypasses
 * is_public and RLS, and one with a useful lifetime eventually expires.
 * Sign at read time with hydrateAudioUrl / hydrateAudioUrls instead
 * (see src/lib/audio/signed-url.ts).
 */
export async function uploadAudio(
  meditationId: string,
  audioBuffer: Buffer,
): Promise<string> {
  const supabase = createServiceClient();
  const filePath = `${meditationId}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  return filePath;
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
