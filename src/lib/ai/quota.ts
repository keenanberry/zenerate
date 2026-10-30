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
 * ceiling, counted in turns (one model run each, a continuation included): it stops a stolen session or a runaway client from running up the
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
 * Every account's turns together, per rolling 24 hours: the per-user ceiling
 * times the number of accounts is otherwise unbounded. At the worst case
 * above (~$0.40 a turn) the default is ~$800 a day; real turns cost a small
 * fraction of that. The Anthropic spend limit stays the hard backstop.
 */
export function getGlobalDailyChatTurnLimit(): number {
  return readPositiveInt("MAX_GLOBAL_DAILY_CHAT_TURNS", 2000);
}

export type ChatTurnReservation =
  | { ok: true }
  | { ok: false; reason: "quota_exceeded" | "global_cap_reached" };

const REFUSALS = new Set(["quota_exceeded", "global_cap_reached"]);

/**
 * Reserve one model turn in the chat_turns ledger, or say which ceiling
 * refused it. Every turn the model runs is one row, continuations included,
 * and the row is keyed by user, so deleting messages or chats refunds
 * nothing. `supabase` must be the service-role client: only it may call
 * reserve_chat_turn, which takes advisory locks so concurrent requests
 * cannot all pass one count.
 */
export async function reserveChatTurn(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatTurnReservation> {
  const { error } = await supabase.rpc("reserve_chat_turn", {
    p_user_id: userId,
    p_per_user_cap: getDailyChatMessageLimit(),
    p_global_cap: getGlobalDailyChatTurnLimit(),
  });
  if (!error) return { ok: true };

  const reason = error.message?.trim();
  if (reason && REFUSALS.has(reason)) {
    return { ok: false, reason: reason as "quota_exceeded" | "global_cap_reached" };
  }
  throw new Error(`reserve_chat_turn failed: ${error.message}`);
}
