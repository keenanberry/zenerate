import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteOwnMeditation } from "@/lib/meditation/delete";

/**
 * DELETE /api/meditations/[id]: the owner deletes one of their meditations,
 * its audio and everything that cascades from it (see deleteOwnMeditation).
 * Runs on the caller's own client, so RLS holds even if this code were
 * wrong. Someone else's meditation, public or not, answers 404: the same as
 * one that does not exist, so a delete reveals nothing.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to delete a meditation" }, 401);

  let outcome;
  try {
    outcome = await deleteOwnMeditation(supabase, user.id, id);
  } catch (err) {
    console.error("Could not delete meditation:", err);
    return json({ error: "Could not delete this meditation" }, 500);
  }

  if (!outcome.ok && outcome.reason === "busy") {
    return json(
      { error: "Its audio is being made. Delete it once that finishes." },
      409,
    );
  }
  if (!outcome.ok) return json({ error: "Meditation not found" }, 404);

  // Gone from every list it was on, Discover included.
  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/discover");
  revalidatePath(`/meditation/${id}`);
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
