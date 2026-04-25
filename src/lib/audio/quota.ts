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

export function getQuotaConfig(): QuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_AUDIO_LIMIT", 3),
    globalCap: readPositiveInt("MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH", 500),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaUsage = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
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
    .in("status", ["pending", "completed"]);

  if (error) {
    throw new Error(`Failed to read quota usage: ${error.message}`);
  }

  const used = count ?? 0;
  return {
    used,
    limit: config.perUserCap,
    remaining: Math.max(config.perUserCap - used, 0),
    resetsAt: nextMonthFirstUtcIso(),
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

export async function reserveAudioGeneration(
  input: ReserveInput,
  supabase: SupabaseClient,
  config: QuotaConfig = getQuotaConfig(),
): Promise<ReserveOutcome> {
  const { data, error } = await supabase.rpc("reserve_audio_generation", {
    p_user_id: input.userId,
    p_meditation_id: input.meditationId,
    p_per_user_cap: config.perUserCap,
    p_global_cap: config.globalCap,
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
