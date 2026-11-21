import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/profile/viewer";
import type { Meditation } from "./types";

/**
 * The reads behind the Library page (`/library`): its four places' counts and
 * Recently played. Server components only, and not a "use server" module:
 * nothing here is a mutation, so none of it needs to be callable from the
 * client. Every read goes through the caller's own RLS-bound client.
 */

/**
 * Meditation ids from plays given newest first: each meditation once, at its
 * newest play, at most `limit` of them.
 */
export function latestDistinct(
  plays: { meditation_id: string; played_at: string }[],
  limit: number,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const { meditation_id } of plays) {
    if (ids.length >= limit) break;
    if (seen.has(meditation_id)) continue;
    seen.add(meditation_id);
    ids.push(meditation_id);
  }
  return ids;
}

/** What a Recently played tile draws: a cover, the title and one meta line. */
export type RecentlyPlayed = Pick<Meditation, "id" | "title" | "tags" | "settings" | "status"> & {
  /** "yours" when the caller made it; anything else came from Discover. */
  source: "yours" | "discover";
};

const RECENT_COLUMNS = "id, user_id, title, tags, settings, status";

/**
 * The caller's most recently played meditations, newest first, each once.
 * Reads up to five plays per tile and keeps every distinct meditation among
 * them, then reads those through the caller's client: RLS drops one that has
 * since gone private (someone else's) or been deleted, and the status filter
 * one being re-rendered, so neither appears. Only then is the list cut to
 * `limit`, so a dropped one is replaced by an older visible play rather than
 * leaving the grid short. A failed read leaves the section empty rather than
 * failing the page.
 */
export async function getRecentlyPlayed(limit = 8): Promise<RecentlyPlayed[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data: plays, error: playsError } = await supabase
    .from("meditation_plays")
    .select("meditation_id, played_at")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .limit(limit * 5);
  if (playsError) {
    console.error("Could not read recent plays:", playsError);
    return [];
  }

  const ids = latestDistinct(plays ?? [], limit * 5);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("meditations")
    .select(RECENT_COLUMNS)
    .in("id", ids)
    .eq("status", "completed");
  if (error) {
    console.error("Could not read recently played meditations:", error);
    return [];
  }

  const order = new Map(ids.map((id, i) => [id, i]));
  return ((data ?? []) as (Omit<RecentlyPlayed, "source"> & { user_id: string })[])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .slice(0, limit)
    .map(({ user_id, ...m }) => ({ ...m, source: user_id === user.id ? "yours" : "discover" }));
}

/** A place's count, or null when it could not be read (the row then shows none). */
export interface LibraryCounts {
  favorites: number | null;
  bookmarks: number | null;
  meditations: number | null;
  collections: number | null;
}

const HEAD = { count: "exact", head: true } as const;

/**
 * How many meditations each Library row leads to, as head-only counts in
 * parallel. Each counts by its list's own rule, so the number matches what
 * the row opens: favourites and bookmarks join their meditation (`!inner`) so
 * RLS drops the ones the caller can no longer read, and bookmarks also apply
 * `listBookmarks`' public-and-completed filter (src/lib/meditation/bookmarks.ts).
 */
export async function getLibraryCounts(): Promise<LibraryCounts> {
  const user = await getSessionUser();
  if (!user) return { favorites: 0, bookmarks: 0, meditations: 0, collections: 0 };
  const supabase = await createClient();

  const read = async (
    place: keyof LibraryCounts,
    query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ) => {
    const { count, error } = await query;
    if (error) {
      console.error(`Could not count the Library's ${place}:`, error);
      return null;
    }
    return count ?? 0;
  };

  const [favorites, bookmarks, meditations, collections] = await Promise.all([
    read(
      "favorites",
      supabase.from("favorites").select("meditation_id, meditations!inner(id)", HEAD).eq("user_id", user.id),
    ),
    read(
      "bookmarks",
      supabase
        .from("meditation_bookmarks")
        .select("meditation_id, meditation:meditations!inner(id)", HEAD)
        .eq("user_id", user.id)
        .eq("meditation.is_public", true)
        .eq("meditation.status", "completed"),
    ),
    read("meditations", supabase.from("meditations").select("id", HEAD).eq("user_id", user.id)),
    read("collections", supabase.from("collections").select("id", HEAD).eq("user_id", user.id)),
  ]);

  return { favorites, bookmarks, meditations, collections };
}
