import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBookmarks, parseBookmarkPage } from "@/lib/meditation/bookmarks";

/**
 * The signed-in listener's bookmarks, newest first (card ZEN-7).
 *
 *   GET ?limit=1..100 (default 50) &cursor=<next_cursor>
 *     → 200 { bookmarks: [{ bookmarked_at, meditation }], next_cursor: string | null }
 *
 * meditation is { id, title, description, tags, settings, status, created_at,
 * author: { id, display_name, avatar_url } | null, rating: { average, count } | null }:
 * what a Discover card shows, without the script or audio. Only public,
 * completed meditations are listed; one that went private since is left out.
 *
 * Signed out: 401. A bad limit or cursor: 400. Runs on the caller's own
 * client, so RLS on meditation_bookmarks keeps it to their own rows.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to see your saved meditations" }, 401);

  const page = parseBookmarkPage(new URL(request.url).searchParams);
  if (!page.ok) return json({ error: page.error }, 400);

  try {
    return json(await listBookmarks(supabase, user.id, { limit: page.limit, cursor: page.cursor }));
  } catch (err) {
    console.error("Could not list bookmarks:", err);
    return json({ error: "Could not load your saved meditations" }, 500);
  }
}
