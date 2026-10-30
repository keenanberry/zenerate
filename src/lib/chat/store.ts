import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chat, ChatMessageRow } from "@/lib/meditation/types";
import type { StudioUIMessage } from "./tools";

/**
 * Chat persistence, shared by the route and the server actions. Deliberately
 * not a "use server" module: saving messages is the route's job, and a
 * client-callable save would let anyone write assistant turns into their own
 * history. The reads take the caller's RLS-bound client, so a chat that is not
 * theirs reads as missing. saveMessages takes the service-role client:
 * chat_messages is read-only to its owner (task 58), and the route saves only
 * after loadChat has shown the chat is the caller's.
 */

export async function loadChat(
  supabase: SupabaseClient,
  chatId: string,
): Promise<Chat | null> {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw new Error(`loading chat failed: ${error.message}`);
  return (data as Chat | null) ?? null;
}

export async function loadMessages(
  supabase: SupabaseClient,
  chatId: string,
): Promise<StudioUIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, metadata")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`loading messages failed: ${error.message}`);

  return (data as Pick<ChatMessageRow, "id" | "role" | "parts" | "metadata">[]).map(
    (row) =>
      ({
        id: row.id,
        role: row.role,
        parts: row.parts,
        ...(row.metadata != null && { metadata: row.metadata }),
      }) as StudioUIMessage,
  );
}

/**
 * Upsert messages in order. An upsert, not an insert: when a client-side tool
 * result lands, the assistant message it belongs to comes back with the same
 * id and more parts. One statement per message keeps `created_at`
 * (clock_timestamp) in conversation order.
 */
export async function saveMessages(
  supabase: SupabaseClient,
  chatId: string,
  messages: StudioUIMessage[],
): Promise<void> {
  for (const message of messages) {
    const { error } = await supabase.from("chat_messages").upsert(
      {
        id: message.id,
        chat_id: chatId,
        role: message.role,
        parts: message.parts,
        metadata: message.metadata ?? null,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`saving message ${message.id} failed: ${error.message}`);
  }
}

/** Bump the chat for "newest first", and name a draft after its first request. */
export async function touchChat(
  supabase: SupabaseClient,
  chat: Pick<Chat, "id" | "title">,
  firstRequest: string | null,
): Promise<void> {
  const update: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };
  if (!chat.title && firstRequest) update.title = truncate(firstRequest, 80);

  const { error } = await supabase.from("chats").update(update).eq("id", chat.id);
  if (error) throw new Error(`updating chat failed: ${error.message}`);
}

/** The plain text of a message's text parts. */
export function messageText(message: Pick<StudioUIMessage, "parts">): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1).trimEnd()}…`;
}
