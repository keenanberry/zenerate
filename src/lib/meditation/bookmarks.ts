import type { SupabaseClient } from "@supabase/supabase-js";
import { withCoverUrl } from "@/lib/cover/url";
import { UUID } from "@/lib/meditation/delete";
import { getRatingStats, type RatingStats } from "@/lib/meditation/ratings";
import { getMeditationAuthors, type MeditationAuthor } from "@/lib/profile/authors";

/**
 * Meditation bookmarks (card ZEN-7): "save for later" on a public
 * meditation, shared by /api/meditations/[id]/bookmark and /api/bookmarks.
 * Not favorites: a favorite is a public-facing "I liked this" that feeds
 * Popular and Picked for you; a bookmark is private and counts toward
 * nothing (tasks/post-ship/bookmarks.md).
 *
 * Not a "use server" module: each function takes the caller's RLS-bound
 * client and the user it belongs to, so the meditation_bookmarks policies
 * hold even if this code were wrong. Only a public, completed meditation can
 * be bookmarked, the owner's own included, as with favorites.
 */

export type BookmarkOutcome<T> = { ok: true; value: T } | { ok: false; reason: "not_found" };

const NOT_FOUND = { ok: false, reason: "not_found" } as const;

/**
 * Whether the meditation can be bookmarked, read through the caller's own
 * client. RLS shows them their own rows and public ones; a private,
 * unfinished or missing meditation all read the same, so a bookmark reveals
 * nothing a read would not.
 */
async function isBookmarkable(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const { data: row, error } = await supabase
    .from("meditations")
    .select("is_public, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`reading meditation failed: ${error.message}`);
  return !!row && row.is_public === true && row.status === "completed";
}

/**
 * Bookmarks a meditation. Idempotent: bookmarking again succeeds with
 * created false. A plain insert, with the primary key's 23505 read as "already
 * there": nothing in the row can change, so there is nothing to upsert.
 */
export async function addBookmark(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<BookmarkOutcome<{ created: boolean }>> {
  if (!(await isBookmarkable(supabase, id))) return NOT_FOUND;

  const { error } = await supabase.from("meditation_bookmarks").insert({ user_id: userId, meditation_id: id });
  if (!error) return { ok: true, value: { created: true } };
  if (error.code === "23505") return { ok: true, value: { created: false } };
  // The insert policy refused the row: the meditation went private (or was
  // deleted) between the check and the write. That is a 404, not a 500.
  if (error.code === "42501") return NOT_FOUND;
  throw new Error(`saving bookmark failed: ${error.message}`);
}

/**
 * Removes the caller's bookmark. Allowed whatever became of the meditation,
 * as the delete_own policy allows it. With nothing to remove, it succeeds
 * only on a meditation the caller could bookmark; anything else is
 * not_found, so a delete reveals nothing a read would not.
 */
export async function removeBookmark(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<BookmarkOutcome<null>> {
  if (!UUID.test(id)) return NOT_FOUND;

  const { data: deleted, error } = await supabase
    .from("meditation_bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("meditation_id", id)
    .select("meditation_id");
  if (error) throw new Error(`deleting bookmark failed: ${error.message}`);
  if (deleted?.length) return { ok: true, value: null };

  return (await isBookmarkable(supabase, id)) ? { ok: true, value: null } : NOT_FOUND;
}

/** The batch lookup looks at no more ids than this per query. */
export const MAX_BOOKMARK_LOOKUP = 100;

/**
 * Which of these meditations the caller has bookmarked, for a bookmark control
 * to show filled or empty, in one query per 100 ids. Signed out (no userId),
 * nothing is bookmarked and nothing is read. Malformed ids are dropped.
 */
export async function getBookmarkedIds(
  supabase: Pick<SupabaseClient, "from">,
  userId: string | null | undefined,
  meditationIds: string[],
): Promise<Set<string>> {
  const bookmarked = new Set<string>();
  if (!userId) return bookmarked;
  const ids = [...new Set(meditationIds)].filter((id) => UUID.test(id));

  for (let i = 0; i < ids.length; i += MAX_BOOKMARK_LOOKUP) {
    const { data, error } = await supabase
      .from("meditation_bookmarks")
      .select("meditation_id")
      .eq("user_id", userId)
      .in("meditation_id", ids.slice(i, i + MAX_BOOKMARK_LOOKUP));
    if (error) throw new Error(`reading bookmarks failed: ${error.message}`);
    for (const row of (data ?? []) as { meditation_id: string }[]) bookmarked.add(row.meditation_id);
  }
  return bookmarked;
}

// ── The list ────────────────────────────────────────────────────────────────

/**
 * What a Discover card needs. No script, and no audio from this read: signed
 * URLs are minted only in actions.ts, whose signBookmarkAudio adds audio_url
 * to a page before it reaches a list.
 */
export interface BookmarkedMeditation {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  /** settings.duration is the length in minutes, as metaLine reads it. */
  settings: { duration?: number } | null;
  status: "completed";
  created_at: string;
  /** The generated cover's object path, or null for the designed cover. */
  cover_path: string | null;
  /** Its public URL, from cover_path (src/lib/cover/url.ts). */
  cover_url: string | null;
  /** Null unless the author has made their profile public. */
  author: MeditationAuthor | null;
  /** Null until someone has rated it. */
  rating: RatingStats | null;
  /** The signed audio, set by signBookmarkAudio; listBookmarks leaves it out. */
  audio_url?: string | null;
}

export interface Bookmark {
  bookmarked_at: string;
  meditation: BookmarkedMeditation;
}

export interface BookmarkPage {
  bookmarks: Bookmark[];
  /** Pass as ?cursor= for the next page; null on the last one. */
  next_cursor: string | null;
}

/** As discover_meditations and profile_meditations: 50 by default, at most 100. */
export const DEFAULT_BOOKMARK_PAGE = 50;
export const MAX_BOOKMARK_PAGE = 100;

const MEDITATION_COLUMNS = "id, title, description, tags, settings, status, created_at, cover_path";

/** A Postgres timestamptz as PostgREST writes it, kept as text so no microseconds are lost. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

interface Cursor {
  created_at: string;
  meditation_id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.created_at}|${cursor.meditation_id}`).toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  const [createdAt, meditationId, ...rest] = Buffer.from(raw, "base64url").toString("utf8").split("|");
  if (rest.length || !createdAt || !meditationId) return null;
  if (!TIMESTAMP.test(createdAt) || !UUID.test(meditationId)) return null;
  return { created_at: createdAt, meditation_id: meditationId };
}

const LIMIT_MESSAGE = `limit must be a whole number from 1 to ${MAX_BOOKMARK_PAGE}`;

/** Reads ?limit= and ?cursor= from the list's URL. */
export function parseBookmarkPage(
  params: URLSearchParams,
): { ok: true; limit: number; cursor: Cursor | null } | { ok: false; error: string } {
  const rawLimit = params.get("limit");
  let limit = DEFAULT_BOOKMARK_PAGE;
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) return { ok: false, error: LIMIT_MESSAGE };
    limit = Number(rawLimit);
    if (limit < 1 || limit > MAX_BOOKMARK_PAGE) return { ok: false, error: LIMIT_MESSAGE };
  }

  const rawCursor = params.get("cursor");
  if (rawCursor === null) return { ok: true, limit, cursor: null };
  const cursor = decodeCursor(rawCursor);
  if (!cursor) return { ok: false, error: "cursor is not one this list gave out" };
  return { ok: true, limit, cursor };
}

/**
 * The caller's bookmarks, newest first, a page at a time. Keyset paging on
 * (created_at, meditation_id), so adding or removing a bookmark between pages
 * neither repeats nor skips one.
 *
 * Only public, completed meditations are listed: one that went private since
 * (the caller's own included) is left out rather than an error, and comes
 * back if it is published again. The filter is in the query, so a page is
 * still full when some are hidden. Authors and rating stats are batched for
 * the page; if either lookup fails the page still comes back without them.
 */
export async function listBookmarks(
  supabase: SupabaseClient,
  userId: string,
  { limit = DEFAULT_BOOKMARK_PAGE, cursor = null }: { limit?: number; cursor?: Cursor | null } = {},
): Promise<BookmarkPage> {
  let query = supabase
    .from("meditation_bookmarks")
    .select(`created_at, meditation_id, meditation:meditations!inner(${MEDITATION_COLUMNS})`)
    .eq("user_id", userId)
    .eq("meditation.is_public", true)
    .eq("meditation.status", "completed");
  if (cursor) {
    // Both values are validated (decodeCursor), and quoted for PostgREST.
    query = query.or(
      `created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",meditation_id.lt.${cursor.meditation_id})`,
    );
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("meditation_id", { ascending: false })
    .limit(limit + 1);
  if (error) throw new Error(`listing bookmarks failed: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    created_at: string;
    meditation_id: string;
    meditation: Omit<BookmarkedMeditation, "author" | "rating" | "cover_url">;
  }[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const next_cursor =
    rows.length > limit && last ? encodeCursor({ created_at: last.created_at, meditation_id: last.meditation_id }) : null;

  const ids = page.map((r) => r.meditation_id);
  const [authors, stats] = ids.length
    ? await Promise.all([
        getMeditationAuthors(supabase, ids).catch((err) => {
          console.error("Could not load bookmark authors:", err);
          return new Map<string, MeditationAuthor>();
        }),
        getRatingStats(supabase, ids).catch((err) => {
          console.error("Could not load bookmark rating stats:", err);
          return new Map<string, RatingStats>();
        }),
      ])
    : [new Map<string, MeditationAuthor>(), new Map<string, RatingStats>()];

  return {
    bookmarks: page.map((r) => ({
      bookmarked_at: r.created_at,
      meditation: {
        ...withCoverUrl(r.meditation),
        author: authors.get(r.meditation_id) ?? null,
        rating: stats.get(r.meditation_id) ?? null,
      },
    })),
    next_cursor,
  };
}
