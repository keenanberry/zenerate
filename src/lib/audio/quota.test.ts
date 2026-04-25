import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getQuotaConfig } from "./quota";

describe("getQuotaConfig", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.PER_USER_MONTHLY_AUDIO_LIMIT;
    delete process.env.MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns defaults when env vars unset", () => {
    const cfg = getQuotaConfig();
    expect(cfg.perUserCap).toBe(3);
    expect(cfg.globalCap).toBe(500);
  });

  it("reads positive integer env vars", () => {
    process.env.PER_USER_MONTHLY_AUDIO_LIMIT = "10";
    process.env.MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH = "1000";
    const cfg = getQuotaConfig();
    expect(cfg.perUserCap).toBe(10);
    expect(cfg.globalCap).toBe(1000);
  });

  it("throws on non-numeric env vars", () => {
    process.env.PER_USER_MONTHLY_AUDIO_LIMIT = "not-a-number";
    expect(() => getQuotaConfig()).toThrow(/PER_USER_MONTHLY_AUDIO_LIMIT/);
  });
});

import { getQuotaUsage } from "./quota";

function makeUsageSupabase(count: number, error: { message: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("getQuotaUsage", () => {
  it("returns used=0 / remaining=limit on empty count", async () => {
    const supabase = makeUsageSupabase(0);
    const usage = await getQuotaUsage(
      "user-1",
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(usage.used).toBe(0);
    expect(usage.remaining).toBe(3);
    expect(usage.limit).toBe(3);
    expect(usage.resetsAt).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
  });

  it("clamps remaining at zero when used exceeds limit", async () => {
    const supabase = makeUsageSupabase(5);
    const usage = await getQuotaUsage(
      "user-1",
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(usage.used).toBe(5);
    expect(usage.remaining).toBe(0);
  });

  it("throws when supabase returns an error", async () => {
    const supabase = makeUsageSupabase(0, { message: "db down" });
    await expect(
      getQuotaUsage("user-1", supabase as never, { perUserCap: 3, globalCap: 500 }),
    ).rejects.toThrow(/db down/);
  });
});

import { isFreeRetryAvailable } from "./quota";

function makeRetrySupabase(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let call = 0;
  return {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        const next = responses[call] ?? { data: null, error: null };
        call += 1;
        return Promise.resolve(next);
      }),
    })),
  };
}

describe("isFreeRetryAvailable", () => {
  it("returns false when no events exist", async () => {
    const supabase = makeRetrySupabase([{ data: null, error: null }]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });

  it("returns true with eventId when latest event is failed and has no retry", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "failed" }, error: null },
      { data: null, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: true, eventId: "evt-1" });
  });

  it("returns false when latest event is not failed", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "completed" }, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });

  it("returns false when failed event already has a retry", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "failed" }, error: null },
      { data: { id: "evt-2" }, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });
});
