import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getScriptQuotaConfig, reserveScriptGeneration, MAX_PROMPT_CHARS } from "./quota";

describe("getScriptQuotaConfig", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.PER_USER_MONTHLY_SCRIPT_LIMIT;
    delete process.env.MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns defaults when env vars unset", () => {
    const cfg = getScriptQuotaConfig();
    expect(cfg.perUserCap).toBe(30);
    expect(cfg.globalCap).toBe(300);
  });

  it("reads positive integer env vars", () => {
    process.env.PER_USER_MONTHLY_SCRIPT_LIMIT = "5";
    process.env.MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS = "50";
    const cfg = getScriptQuotaConfig();
    expect(cfg.perUserCap).toBe(5);
    expect(cfg.globalCap).toBe(50);
  });

  it("throws on non-numeric env vars", () => {
    process.env.PER_USER_MONTHLY_SCRIPT_LIMIT = "lots";
    expect(() => getScriptQuotaConfig()).toThrow(/PER_USER_MONTHLY_SCRIPT_LIMIT/);
  });
});

function makeRpcSupabase(rpcResult: { data: unknown; error: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) };
}

describe("reserveScriptGeneration", () => {
  const config = { perUserCap: 30, globalCap: 300 };

  it("returns the new event id on success", async () => {
    const supabase = makeRpcSupabase({ data: "evt-1", error: null });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: true, eventId: "evt-1" });
    expect(supabase.rpc).toHaveBeenCalledWith("reserve_script_generation", {
      p_user_id: "user-1",
      p_per_user_cap: 30,
      p_global_cap: 300,
    });
  });

  it("maps quota_exceeded", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "quota_exceeded" } });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: false, reason: "quota_exceeded" });
  });

  it("maps global_cap_reached", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "global_cap_reached" } });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: false, reason: "global_cap_reached" });
  });

  it("rethrows unknown errors", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "connection refused" } });
    await expect(
      reserveScriptGeneration("user-1", supabase as never, config),
    ).rejects.toThrow(/connection refused/);
  });
});

describe("MAX_PROMPT_CHARS", () => {
  it("is a sane positive cap", () => {
    expect(MAX_PROMPT_CHARS).toBeGreaterThan(500);
    expect(MAX_PROMPT_CHARS).toBeLessThan(20000);
  });
});
