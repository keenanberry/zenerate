import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upper bound on the text of a single chat message. A meditation request is a
 * sentence or two; this is an abuse guard, not a product limit.
 */
export const MAX_MESSAGE_CHARS = 4000;

export function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return parsed;
}

/**
 * Chat turns are not metered against any user-facing quota. This is an abuse
 * ceiling: it stops a stolen session or a runaway client from running up the
 * Anthropic bill, and normal use never comes near it.
 *
 * Sized off the worst case, like the audio caps:
 *
 *   maxOutputTokens: 8000 per step, 5 steps per turn (src/app/api/chat/route.ts)
 *   claude-sonnet-5 output at $10/MTok -> ~$0.40 worst case per turn in output
 *   200 turns -> ~$80 per user per day, worst case
 *
 * Input tokens grow with the conversation and are not in that figure. Real
 * turns are far smaller: a script is ~1-2k output tokens and most turns are a
 * one-line reply. Revisit the default if worst-case exposure needs to come down.
 */
export function getDailyChatMessageLimit(): number {
  return readPositiveInt("PER_USER_DAILY_CHAT_MESSAGES", 200);
}

/**
 * The user's own messages over the last 24 hours, across all their chats.
 * Runs on the RLS-bound client, so it can only ever see the caller's rows; the
 * join filter says the same thing explicitly.
 */
export async function countRecentUserMessages(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("chat_messages")
    .select("id, chats!inner(user_id)", { count: "exact", head: true })
    .eq("chats.user_id", userId)
    .eq("role", "user")
    .gte("created_at", since);

  if (error) throw new Error(`counting chat messages failed: ${error.message}`);
  return count ?? 0;
}
