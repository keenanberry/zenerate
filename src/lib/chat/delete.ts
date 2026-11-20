import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID, type DeleteOutcome } from "@/lib/meditation/delete";

/**
 * Deleting a studio chat, for DELETE /api/chats/[id]. Takes the caller's
 * RLS-bound client: `delete_own` on chats limits the delete to the owner,
 * and chat_messages cascades from chats. The meditation the chat made is
 * left alone; it is deleted on its own. chat_turns is keyed by user, not
 * chat, so the daily chat ceiling is not refunded.
 */
export async function deleteOwnChat(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<Exclude<DeleteOutcome, { reason: "busy" }>> {
  if (!UUID.test(id)) return { ok: false, reason: "not_found" };

  const { data, error } = await supabase
    .from("chats")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(`deleting chat failed: ${error.message}`);
  if (!data?.length) return { ok: false, reason: "not_found" };
  return { ok: true };
}
