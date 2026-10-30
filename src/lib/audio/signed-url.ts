import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { ownsAudioPath } from "./storage";

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
 * A row to hydrate: a meditation (id, user_id), an archived version (id,
 * meditation_id), or a meditation read as anon, whose public columns leave
 * out user_id and audio_path (task 58).
 */
type AudioRow = {
  id?: string;
  user_id?: string | null;
  meditation_id?: string;
  audio_path?: string | null;
};

/** The row's own audio path, or null when it has none or names someone else's file. */
function ownPath(row: AudioRow): string | null {
  const meditationId = row.meditation_id ?? row.id;
  if (!row.audio_path || !meditationId) return null;
  const userId = row.meditation_id ? null : row.user_id;
  if (ownsAudioPath(row.audio_path, { userId, meditationId })) return row.audio_path;
  console.error(`Not signing "${row.audio_path}": it is outside meditation ${meditationId}'s audio.`);
  return null;
}

/**
 * The paths of rows read without audio_path, by id. anon may not read the
 * column, so it is read here with the service role, for public meditations
 * only: a row the caller saw without the column is a public one (or it is
 * not, and gets no audio).
 */
async function lookUpPublicPaths(
  rows: AudioRow[],
  supabase: SupabaseClient,
): Promise<Map<string, string | null>> {
  const ids = rows.flatMap((row) => (!("audio_path" in row) && row.id ? [row.id] : []));
  const paths = new Map<string, string | null>();
  if (ids.length === 0) return paths;

  const { data, error } = await supabase
    .from("meditations")
    .select("id, user_id, audio_path")
    .in("id", ids)
    .eq("is_public", true);
  if (error) {
    console.error(`Failed to look up public audio paths: ${error.message}`);
    return paths;
  }
  for (const row of (data ?? []) as AudioRow[]) paths.set(row.id!, ownPath(row));
  return paths;
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
 * Two checks of its own back that up (task 58). A path outside the row's own
 * folder is never signed, whatever the row says (see ownsAudioPath). And a
 * row read without audio_path, as anon reads every meditation, is signed
 * only if the service role finds the meditation public; the path itself
 * never joins the row, so it never reaches the page.
 *
 * This is why signAudioUrl/signAudioUrls above are not exported, and why
 * `@/lib/audio/signed-url` is restricted (see eslint.config.mjs) to
 * `src/lib/meditation/actions.ts`, the one module whose every call site
 * fetches the row through an RLS-bound client first.
 */
export async function hydrateAudioUrl<T extends AudioRow>(
  row: T,
): Promise<T & { audio_url: string | null }> {
  const [hydrated] = await hydrateAudioUrls([row]);
  return hydrated;
}

/** See hydrateAudioUrl -- same invariant: hydrate only rows already authorized by an RLS-bound fetch. */
export async function hydrateAudioUrls<T extends AudioRow>(
  rows: T[],
): Promise<Array<T & { audio_url: string | null }>> {
  if (rows.length === 0) return [];
  const supabase = createServiceClient();
  const looked = await lookUpPublicPaths(rows, supabase);
  const paths = rows.map((row) =>
    "audio_path" in row ? ownPath(row) : (looked.get(row.id ?? "") ?? null),
  );
  const urls =
    paths.length === 1
      ? [await signAudioUrl(paths[0], supabase)]
      : await signAudioUrls(paths, supabase);
  return rows.map((row, i) => ({ ...row, audio_url: urls[i] }));
}
