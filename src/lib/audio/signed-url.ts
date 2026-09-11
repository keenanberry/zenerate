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
 *
 * SECURITY INVARIANT: this function performs NO authorization of its own.
 * `storage.objects` has no RLS policies for the meditation-audio bucket, so
 * in practice `supabase` must be a service-role client -- an RLS-bound
 * client will fail to sign anything, including the caller's own audio.
 * Because signing bypasses RLS entirely, the caller is responsible for
 * having already verified that whoever will receive this URL is entitled to
 * `path` (e.g. `path` came from a meditation row fetched through an
 * RLS-bound client). Sign a path obtained any other way and you will hand
 * out someone else's private audio.
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
 *
 * SECURITY INVARIANT: same as signAudioUrl -- no authorization happens here.
 * `supabase` must be a service-role client (storage.objects has no RLS
 * policies for this bucket), and every path passed in must already have
 * been authorized by an RLS-bound row fetch. This function will sign
 * whatever path it is given.
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
