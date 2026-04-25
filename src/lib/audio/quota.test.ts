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
