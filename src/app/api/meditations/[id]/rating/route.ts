import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOwnRating,
  getOwnRating,
  parseRating,
  rateMeditation,
  type RatingRefusal,
} from "@/lib/meditation/ratings";

/**
 * The signed-in listener's own rating of a meditation (card ZEN-5).
 *
 *   GET     → 200 { rating: { stars, created_at, updated_at } | null }
 *   PUT     { stars: 1..5 } → 201 { rating } when new, 200 { rating } when changed
 *   DELETE  → 204
 *
 * Signed out: 401. A meditation that does not exist, is private (even the
 * caller's own) or is not completed: 404, so a rating reveals nothing a read
 * would not. Rating one's own meditation: 403. A bad body: 400.
 *
 * Every method runs on the caller's own client, so RLS on meditation_ratings
 * holds even if this code were wrong. The average and count are not here:
 * they are public, and come from getRatingStats (meditation_rating_stats).
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** The average and count shown on Discover and the page change with every write. */
function refreshStats(id: string) {
  revalidatePath("/discover");
  revalidatePath(`/meditation/${id}`);
}

function refused(reason: RatingRefusal) {
  return reason === "own"
    ? json({ error: "You can't rate your own meditation" }, 403)
    : json({ error: "Meditation not found" }, 404);
}

type Params = { params: Promise<{ id: string }> };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return json({ error: "Sign in to see your rating" }, 401);

  try {
    const outcome = await getOwnRating(supabase, user.id, id);
    if (!outcome.ok) return refused(outcome.reason);
    return json({ rating: outcome.value });
  } catch (err) {
    console.error("Could not read rating:", err);
    return json({ error: "Could not load your rating" }, 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return json({ error: "Sign in to rate a meditation" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const parsed = parseRating(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const outcome = await rateMeditation(supabase, user.id, id, parsed.stars);
    if (!outcome.ok) return refused(outcome.reason);
    refreshStats(id);
    return json({ rating: outcome.value.rating }, outcome.value.created ? 201 : 200);
  } catch (err) {
    console.error("Could not save rating:", err);
    return json({ error: "Could not save your rating" }, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return json({ error: "Sign in to remove your rating" }, 401);

  try {
    const outcome = await deleteOwnRating(supabase, user.id, id);
    if (!outcome.ok) return refused(outcome.reason);
    refreshStats(id);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    console.error("Could not delete rating:", err);
    return json({ error: "Could not remove your rating" }, 500);
  }
}
