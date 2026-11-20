import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteOwnChat } from "@/lib/chat/delete";

/**
 * DELETE /api/chats/[id]: the owner deletes a studio chat and its messages.
 * Runs on the caller's own client, so RLS holds even if this code were
 * wrong. Someone else's chat answers 404, the same as one that does not
 * exist.
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
  if (!user) return json({ error: "Sign in to delete a chat" }, 401);

  let outcome;
  try {
    outcome = await deleteOwnChat(supabase, user.id, id);
  } catch (err) {
    console.error("Could not delete chat:", err);
    return json({ error: "Could not delete this chat" }, 500);
  }
  if (!outcome.ok) return json({ error: "Chat not found" }, 404);

  revalidatePath("/account");
  revalidatePath("/create");
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
