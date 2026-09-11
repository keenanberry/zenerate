import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "meditation-audio";

/**
 * How long a minted audio URL stays valid. Long enough that a user can open a
 * meditation, read the script, and play it later in the same session --
 * wavesurfer re-requests the file on seek -- and short enough that a leaked
 * link is not a permanent grant.
 */
export const AUDIO_URL_TTL_SECONDS = 4 * 60 * 60;

/**
 * Sign a single storage path. Returns null on a null path or a signing
 * failure -- callers render a "no audio" state rather than a broken player,
 * and a missing object should not take down the page.
 */
export async function signAudioUrl(
  path: string | null,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, AUDIO_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error(`Failed to sign audio path "${path}": ${error?.message}`);
    return null;
  }
  return data.signedUrl;
}

/**
 * Sign many paths in one round trip, preserving input order and null slots.
 * List views render dozens of meditations; signing them individually would be
 * one network call each.
 */
export async function signAudioUrls(
  paths: Array<string | null>,
  supabase: SupabaseClient,
): Promise<Array<string | null>> {
  const present = paths.filter((p): p is string => Boolean(p));
  if (present.length === 0) return paths.map(() => null);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(present, AUDIO_URL_TTL_SECONDS);

  if (error || !data) {
    console.error(`Failed to batch-sign audio paths: ${error?.message}`);
    return paths.map(() => null);
  }

  const byPath = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) {
      byPath.set(entry.path, entry.signedUrl);
    }
  }

  return paths.map((p) => (p ? byPath.get(p) ?? null : null));
}
