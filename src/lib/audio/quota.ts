export type QuotaConfig = {
  perUserCap: number;
  globalCap: number;
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return parsed;
}

/**
 * Caps are derived from the purchased ElevenLabs plan, not chosen freely.
 *
 *   Starter: 30,000 credits/month
 *   Measured: ~930 speech characters per meditation
 *   30,000 / 930 = ~32 generations, minus headroom for retries and
 *   longer-than-average scripts = 25
 *
 * Revisit this whenever the ElevenLabs plan changes. On Creator (121k
 * credits) the equivalent figure is ~100.
 */
export function getQuotaConfig(): QuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_AUDIO_LIMIT", 3),
    globalCap: readPositiveInt("MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH", 25),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The operator's accounts, from `QUOTA_EXEMPT_USER_IDS` (comma-separated
 * user ids). Read on every call so a test or a redeploy sees the current
 * value. ElevenLabs' own credit balance is the backstop for these renders.
 */
function exemptUserIds(): string[] {
  return (process.env.QUOTA_EXEMPT_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** An exempt user skips both caps, and their renders don't count toward the global total. */
export function isQuotaExempt(userId: string): boolean {
  return exemptUserIds().includes(userId);
}

/** Postgres integer max: a cap the reserve RPC can never reach. */
const NO_CAP = 2147483647;

export type QuotaUsage = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  /** True for an exempt user; `remaining` is then meaningless. */
  unlimited: boolean;
};

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonthFirstUtcIso(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

export async function getQuotaUsage(
  userId: string,
  supabase: SupabaseClient,
  config: QuotaConfig = getQuotaConfig(),
): Promise<QuotaUsage> {
  const { count, error } = await supabase
    .from("audio_generation_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("year_month", currentYearMonth())
    .eq("is_free_retry", false)
    // The RPC's predicate: a failed render counts, only a refund does not.
    .neq("status", "refunded");

  if (error) {
    throw new Error(`Failed to read quota usage: ${error.message}`);
  }

  const used = count ?? 0;
  return {
    used,
    limit: config.perUserCap,
    remaining: Math.max(config.perUserCap - used, 0),
    resetsAt: nextMonthFirstUtcIso(),
    unlimited: isQuotaExempt(userId),
  };
}

export type FreeRetryStatus = {
  available: boolean;
  eventId: string | null;
};

export async function isFreeRetryAvailable(
  meditationId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<FreeRetryStatus> {
  const { data: latest, error: latestError } = await supabase
    .from("audio_generation_events")
    .select("id, status")
    .eq("meditation_id", meditationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to read latest event: ${latestError.message}`);
  }
  if (!latest || latest.status !== "failed") {
    return { available: false, eventId: null };
  }

  const { data: existingRetry, error: retryError } = await supabase
    .from("audio_generation_events")
    .select("id")
    .eq("retry_of", latest.id)
    .limit(1)
    .maybeSingle();

  if (retryError) {
    throw new Error(`Failed to read retry events: ${retryError.message}`);
  }
  if (existingRetry) {
    return { available: false, eventId: null };
  }
  return { available: true, eventId: latest.id };
}

export type ReserveInput = {
  userId: string;
  meditationId: string;
  retryOfEventId: string | null;
};

export type ReserveOutcome =
  | { ok: true; eventId: string }
  | { ok: false; reason: "quota_exceeded" | "global_cap_reached" | "invalid_retry" };

const MAPPED_REASONS = new Set(["quota_exceeded", "global_cap_reached", "invalid_retry"]);

/**
 * Exempt users' counted events this month, so the global cap can be raised
 * past them. Same predicate as the RPC's global count.
 */
async function countExemptEvents(exemptIds: string[], supabase: SupabaseClient): Promise<number> {
  if (exemptIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("audio_generation_events")
    .select("id", { count: "exact", head: true })
    .in("user_id", exemptIds)
    .eq("year_month", currentYearMonth())
    .eq("is_free_retry", false)
    .neq("status", "refunded");
  if (error) {
    throw new Error(`Failed to count exempt generations: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * The exemption lives here rather than in the RPC, so it needs no migration.
 * An exempt user reserves with caps the RPC can never reach (retries are
 * still validated). Everyone else gets the global cap raised by the exempt
 * events already counted, which takes them out of the total. An exempt
 * render landing between that count and the RPC lowers the effective cap by
 * one for that request, which errs on the safe side.
 */
export async function reserveAudioGeneration(
  input: ReserveInput,
  supabase: SupabaseClient,
  config: QuotaConfig = getQuotaConfig(),
): Promise<ReserveOutcome> {
  const exemptIds = exemptUserIds();
  const exempt = exemptIds.includes(input.userId);
  const caps = exempt
    ? { perUser: NO_CAP, global: NO_CAP }
    : {
        perUser: config.perUserCap,
        global: config.globalCap + (await countExemptEvents(exemptIds, supabase)),
      };

  const { data, error } = await supabase.rpc("reserve_audio_generation", {
    p_user_id: input.userId,
    p_meditation_id: input.meditationId,
    p_per_user_cap: caps.perUser,
    p_global_cap: caps.global,
    p_retry_of: input.retryOfEventId,
  });

  if (error) {
    const reason = error.message?.trim();
    if (reason && MAPPED_REASONS.has(reason)) {
      return { ok: false, reason: reason as Extract<ReserveOutcome, { ok: false }>["reason"] };
    }
    throw new Error(`reserve_audio_generation failed: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error("reserve_audio_generation returned non-string");
  }
  return { ok: true, eventId: data };
}
