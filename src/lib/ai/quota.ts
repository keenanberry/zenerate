import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upper bound on a single generation prompt. The wizard's generated prompts
 * are a few hundred characters; this is an abuse guard, not a product limit.
 */
export const MAX_PROMPT_CHARS = 4000;

export type ScriptQuotaConfig = {
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
 * Script generation is ~$0.02 per call, so these caps are deliberately
 * generous. They exist to stop an open endpoint being used as a free Claude
 * proxy, not to ration the product.
 */
export function getScriptQuotaConfig(): ScriptQuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_SCRIPT_LIMIT", 30),
    globalCap: readPositiveInt("MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS", 300),
  };
}

export type ScriptReserveOutcome =
  | { ok: true; eventId: string }
  | { ok: false; reason: "quota_exceeded" | "global_cap_reached" };

const MAPPED_REASONS = new Set(["quota_exceeded", "global_cap_reached"]);

export async function reserveScriptGeneration(
  userId: string,
  supabase: SupabaseClient,
  config: ScriptQuotaConfig = getScriptQuotaConfig(),
): Promise<ScriptReserveOutcome> {
  const { data, error } = await supabase.rpc("reserve_script_generation", {
    p_user_id: userId,
    p_per_user_cap: config.perUserCap,
    p_global_cap: config.globalCap,
  });

  if (error) {
    const reason = error.message?.trim();
    if (reason && MAPPED_REASONS.has(reason)) {
      return {
        ok: false,
        reason: reason as Extract<ScriptReserveOutcome, { ok: false }>["reason"],
      };
    }
    throw new Error(`reserve_script_generation failed: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error("reserve_script_generation returned non-string");
  }
  return { ok: true, eventId: data };
}
