import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { UUID } from "@/lib/meditation/delete";

/**
 * Meditation ratings (card ZEN-5): one 1–5 star rating per listener per
 * public meditation, shared by /api/meditations/[id]/rating. Not a
 * "use server" module: each function takes the caller's RLS-bound client and
 * the user it belongs to, so the meditation_ratings policies hold even if
 * this code were wrong. Only a public, completed meditation that is not the
 * caller's own can be rated (insert_own and update_own check the same).
 *
 * Nobody reads another listener's rating. The average and count come from
 * meditation_rating_stats, through getRatingStats below.
 */

export interface Rating {
  stars: number;
  created_at: string;
  updated_at: string;
}

/** A meditation's rating summary; average is rounded to one decimal. */
export interface RatingStats {
  average: number;
  count: number;
}

export const RATING_COLUMNS = "stars, created_at, updated_at";

/** Kept in step with meditation_ratings_stars_range. */
const STARS_MESSAGE = "stars must be a whole number from 1 to 5";
const ratingSchema = z.strictObject({
  stars: z.int({ message: STARS_MESSAGE }).min(1, { message: STARS_MESSAGE }).max(5, { message: STARS_MESSAGE }),
});

export function parseRating(
  body: unknown,
): { ok: true; stars: number } | { ok: false; error: string } {
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rating" };
  return { ok: true, stars: parsed.data.stars };
}

/**
 * not_found: no such meditation, or one the caller cannot see, or one that
 * is not public and completed. own: the caller made it.
 */
export type RatingRefusal = "not_found" | "own";

export type RatingOutcome<T> = { ok: true; value: T } | { ok: false; reason: RatingRefusal };

/** Whether the caller may rate this meditation, read through their own client. */
async function checkRateable(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RatingRefusal | null> {
  if (!UUID.test(id)) return "not_found";
  // RLS shows the caller their own rows and public ones; anything else reads
  // as missing, exactly like a meditation that does not exist.
  const { data: row, error } = await supabase
    .from("meditations")
    .select("user_id, is_public, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`reading meditation failed: ${error.message}`);
  if (!row || !row.is_public || row.status !== "completed") return "not_found";
  if (row.user_id === userId) return "own";
  return null;
}

/** The caller's rating of a meditation they may rate, or null if they have none. */
export async function getOwnRating(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RatingOutcome<Rating | null>> {
  const refusal = await checkRateable(supabase, userId, id);
  // An owner has no rating of their own work: say so rather than 403 a read.
  if (refusal === "own") return { ok: true, value: null };
  if (refusal) return { ok: false, reason: refusal };

  const { data, error } = await supabase
    .from("meditation_ratings")
    .select(RATING_COLUMNS)
    .eq("meditation_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading rating failed: ${error.message}`);
  return { ok: true, value: (data as Rating | null) ?? null };
}

/**
 * Creates the caller's rating or changes its stars. Update first, insert if
 * there was nothing to update: the column grants allow only stars to change,
 * which PostgREST's upsert would break by rewriting the key columns. Two
 * requests racing to insert meet the primary key; the loser updates instead.
 */
export async function rateMeditation(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  stars: number,
): Promise<RatingOutcome<{ rating: Rating; created: boolean }>> {
  const refusal = await checkRateable(supabase, userId, id);
  if (refusal) return { ok: false, reason: refusal };

  const update = () =>
    supabase
      .from("meditation_ratings")
      .update({ stars })
      .eq("meditation_id", id)
      .eq("user_id", userId)
      .select(RATING_COLUMNS);

  const first = await update();
  if (first.error) return refusedOrThrow(first.error, "updating rating");
  if (first.data?.length) return { ok: true, value: { rating: first.data[0] as Rating, created: false } };

  const inserted = await supabase
    .from("meditation_ratings")
    .insert({ meditation_id: id, user_id: userId, stars })
    .select(RATING_COLUMNS)
    .single();
  if (!inserted.error) return { ok: true, value: { rating: inserted.data as Rating, created: true } };
  if (inserted.error.code !== "23505") return refusedOrThrow(inserted.error, "saving rating");

  const retry = await update();
  if (retry.error) return refusedOrThrow(retry.error, "updating rating");
  if (!retry.data?.length) throw new Error("saving rating failed: the rating vanished mid-write");
  return { ok: true, value: { rating: retry.data[0] as Rating, created: false } };
}

/**
 * 42501 is the policy refusing the row: the meditation went private (or was
 * deleted) between the check and the write. That is a 404, not a 500.
 */
function refusedOrThrow(
  error: { code?: string; message: string },
  what: string,
): { ok: false; reason: "not_found" } {
  if (error.code === "42501") return { ok: false, reason: "not_found" };
  throw new Error(`${what} failed: ${error.message}`);
}

/**
 * Removes the caller's rating. Allowed whatever became of the meditation, as
 * the delete_own policy allows it, so a rating on a meditation made private
 * since can still be taken back. With nothing to remove, it succeeds only on a
 * meditation the caller could rate; anything else is not_found, so a delete
 * reveals nothing a read would not.
 */
export async function deleteOwnRating(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RatingOutcome<null>> {
  if (!UUID.test(id)) return { ok: false, reason: "not_found" };

  const { data: deleted, error } = await supabase
    .from("meditation_ratings")
    .delete()
    .eq("meditation_id", id)
    .eq("user_id", userId)
    .select("stars");
  if (error) throw new Error(`deleting rating failed: ${error.message}`);
  if (deleted?.length) return { ok: true, value: null };

  const refusal = await checkRateable(supabase, userId, id);
  if (refusal === "not_found") return { ok: false, reason: refusal };
  // Nothing to remove on a meditation they may see: their own, or one they
  // never rated. Either way there is no rating now, which is what was asked.
  return { ok: true, value: null };
}

/** meditation_rating_stats looks at no more ids than this per call. */
export const MAX_RATING_LOOKUP = 100;

/**
 * Average and count per meditation, keyed by meditation id, in one call to
 * meditation_rating_stats per 100 ids, so Discover and the meditation page
 * can batch-fetch a whole row. A meditation is missing from the map when it
 * has no ratings or is not public. Works on any client, signed out included.
 */
export async function getRatingStats(
  supabase: Pick<SupabaseClient, "rpc">,
  meditationIds: string[],
): Promise<Map<string, RatingStats>> {
  const stats = new Map<string, RatingStats>();
  const ids = [...new Set(meditationIds)].filter((id) => UUID.test(id));

  for (let i = 0; i < ids.length; i += MAX_RATING_LOOKUP) {
    const { data, error } = await supabase.rpc("meditation_rating_stats", {
      p_meditation_ids: ids.slice(i, i + MAX_RATING_LOOKUP),
    });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      meditation_id: string;
      average: number | string;
      count: number | string;
    }[]) {
      // PostgREST sends numeric and bigint as JSON numbers, but be explicit.
      stats.set(row.meditation_id, { average: Number(row.average), count: Number(row.count) });
    }
  }
  return stats;
}

/**
 * Adds each meditation's average and count to every list, in one batched
 * lookup for all of them (Discover's rows share one). A failed lookup leaves
 * the lists as they were: a page without averages beats no page.
 */
export async function withRatingStats<T extends { id: string; rating?: RatingStats }>(
  supabase: Pick<SupabaseClient, "rpc">,
  lists: T[][],
): Promise<T[][]> {
  const ids = lists.flat().map((m) => m.id);
  if (ids.length === 0) return lists;
  const stats = await getRatingStats(supabase, ids).catch(() => null);
  if (!stats) return lists;
  return lists.map((list) =>
    list.map((m) => {
      const rating = stats.get(m.id);
      return rating ? { ...m, rating } : m;
    }),
  );
}
