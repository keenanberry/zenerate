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
 * ceiling, counted in turns (one model run each, a continuation included): it
 * stops a stolen session or a runaway client from running up the Anthropic
 * bill, and normal use stays well under it.
 *
 * Sized for the free tier before signups open (2026-10-31; the cost model is
 * in tasks/post-ship/paid-tier.md):
 *
 *   A meditation is about five turns: the draft, a revision or two, "make the
 *   audio", and the card's continuation. 30 turns a day is about six of those.
 *   Measured on claude-sonnet-5-5 (ship 47) a writing turn costs $0.02-0.04,
 *   so one account tops out near $1 a day in practice.
 *
 *   Worst case: maxOutputTokens 8000 per step, 5 steps per turn
 *   (src/app/api/chat/route.ts) at $10/MTok output -> ~$0.40 a turn, ~$12 a
 *   day. Input tokens grow with the conversation and are not in that figure.
 *
 * A paid plan would raise this per user (paid-tier.md). The Anthropic spend
 * limit stays the hard backstop.
 */
export function getDailyChatMessageLimit(): number {
  return readPositiveInt("PER_USER_DAILY_CHAT_MESSAGES", 30);
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
