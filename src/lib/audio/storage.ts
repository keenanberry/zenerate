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
 * Upload an MP3 buffer to Supabase Storage and return a signed URL.
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

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  if (urlError || !data?.signedUrl) {
    throw new Error(`Signed URL creation failed: ${urlError?.message}`);
  }

  return data.signedUrl;
}

/**
 * Update a meditation record's status and optional audio_url / generation_meta.
 */
export async function updateMeditationStatus(
  meditationId: string,
  status: string,
  audioUrl?: string,
  generationMeta?: GenerationMeta,
): Promise<void> {
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (audioUrl !== undefined) {
    update.audio_url = audioUrl;
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
