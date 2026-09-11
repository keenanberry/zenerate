import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";

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
 * NOT EXPORTED. This performs no authorization of its own -- it signs
 * whatever path it is handed with whatever client it is handed. The only
 * callers are hydrateAudioUrl / hydrateAudioUrls below, which are the sole
 * exports of this module and the only supported way to mint an audio URL.
 * See their doc comments for the authorization invariant this relies on.
 */
async function signAudioUrl(
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
 * NOT EXPORTED -- see signAudioUrl above.
 */
async function signAudioUrls(
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

/**
 * Rows come back with audio_path; every consumer expects audio_url. Sign the
 * path into a short-lived URL so client components need no changes.
 *
 * SECURITY INVARIANT: signs with an internally-constructed service-role
 * client, which performs NO authorization of its own -- storage.objects has
 * no RLS policies for the meditation-audio bucket, so a service-role
 * signature is the only kind that succeeds. Because this function cannot
 * check who is entitled to `row`, the authorization check must already have
 * happened when `row` was fetched -- through an RLS-bound client (e.g.
 * `createClient()` from "@/lib/supabase/server"). If that query returned the
 * row, the caller is entitled to see it. Only ever call this on a row that
 * came from such a fetch. Hydrating a row obtained any other way (a route
 * param, a client component, a hand-built object) skips that check entirely
 * and will hand out another user's private audio.
 *
 * This is why signAudioUrl/signAudioUrls above are not exported, and why
 * `@/lib/audio/signed-url` is restricted (see eslint.config.mjs) to
 * `src/lib/meditation/actions.ts`, the one module whose every call site
 * fetches the row through an RLS-bound client first.
 */
export async function hydrateAudioUrl<T extends { audio_path?: string | null }>(
  row: T,
): Promise<T & { audio_url: string | null }> {
  const supabase = createServiceClient();
  return { ...row, audio_url: await signAudioUrl(row.audio_path ?? null, supabase) };
}

/** See hydrateAudioUrl -- same invariant: hydrate only rows already authorized by an RLS-bound fetch. */
export async function hydrateAudioUrls<T extends { audio_path?: string | null }>(
  rows: T[],
): Promise<Array<T & { audio_url: string | null }>> {
  const supabase = createServiceClient();
  const urls = await signAudioUrls(rows.map((r) => r.audio_path ?? null), supabase);
  return rows.map((row, i) => ({ ...row, audio_url: urls[i] }));
}
