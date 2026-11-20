import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addBookmark, removeBookmark } from "@/lib/meditation/bookmarks";

/**
 * The signed-in listener's bookmark ("save for later") on a meditation
 * (card ZEN-7). Both methods are idempotent.
 *
 *   PUT     → 201 { bookmarked: true } when new, 200 when it was already there
 *   DELETE  → 204, also when there was nothing to remove
 *
 * Signed out: 401. A meditation that does not exist, is private (even the
 * caller's own) or is not completed: 404, so a bookmark reveals nothing a
 * read would not. An owner may bookmark their own public meditation, as with
 * favorites. Removing a bookmark on a meditation that has gone private since
 * succeeds. No body.
 *
 * Both run on the caller's own client, so RLS on meditation_bookmarks holds
 * even if this code were wrong. The list is GET /api/bookmarks.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

const notFound = () => json({ error: "Meditation not found" }, 404);

type Params = { params: Promise<{ id: string }> };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PUT(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return json({ error: "Sign in to save a meditation" }, 401);

  try {
    const outcome = await addBookmark(supabase, user.id, id);
    if (!outcome.ok) return notFound();
    return json({ bookmarked: true }, outcome.value.created ? 201 : 200);
  } catch (err) {
    console.error("Could not save bookmark:", err);
    return json({ error: "Could not save this meditation" }, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return json({ error: "Sign in to remove a saved meditation" }, 401);

  try {
    const outcome = await removeBookmark(supabase, user.id, id);
    if (!outcome.ok) return notFound();
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    console.error("Could not delete bookmark:", err);
    return json({ error: "Could not remove this saved meditation" }, 500);
  }
}
