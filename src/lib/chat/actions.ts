"use server";

import { createClient } from "@/lib/supabase/server";
import { getMeditation } from "@/lib/meditation/actions";
import type { Chat, MeditationWithMeta } from "@/lib/meditation/types";
import { loadChat, loadMessages } from "./store";
import type { StudioUIMessage } from "./tools";

/** A new draft chat: no meditation until the agent's first writeScript. */
export async function createChat(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create chat");
  return { id: data.id as string };
}

/**
 * A chat with its messages and, once the first script exists, its
 * meditation. Null when the chat does not exist or is not the caller's: RLS
 * makes those the same thing.
 */
export async function getChat(id: string): Promise<{
  chat: Chat;
  messages: StudioUIMessage[];
  meditation: MeditationWithMeta | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const chat = await loadChat(supabase, id);
  if (!chat) return null;

  const [messages, meditation] = await Promise.all([
    loadMessages(supabase, id),
    chat.meditation_id ? getMeditation(chat.meditation_id) : Promise.resolve(null),
  ]);

  return { chat, messages, meditation };
}

/** The caller's chats that have no script yet, newest first. */
export async function listDraftChats(): Promise<Chat[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", user.id)
    .is("meditation_id", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Chat[];
}
