import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getDailyChatMessageLimit,
  getGlobalDailyChatTurnLimit,
  MAX_MESSAGE_CHARS,
  reserveChatTurn,
} from "./quota";

describe("getDailyChatMessageLimit", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.PER_USER_DAILY_CHAT_MESSAGES;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("defaults to 200", () => {
    expect(getDailyChatMessageLimit()).toBe(200);
  });

  it("reads a positive integer env var", () => {
    process.env.PER_USER_DAILY_CHAT_MESSAGES = "5";
    expect(getDailyChatMessageLimit()).toBe(5);
  });

  it("throws on a non-numeric env var", () => {
    process.env.PER_USER_DAILY_CHAT_MESSAGES = "lots";
    expect(() => getDailyChatMessageLimit()).toThrow(/PER_USER_DAILY_CHAT_MESSAGES/);
  });
});

describe("getGlobalDailyChatTurnLimit", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.MAX_GLOBAL_DAILY_CHAT_TURNS;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("defaults to 2000", () => {
    expect(getGlobalDailyChatTurnLimit()).toBe(2000);
  });

  it("reads a positive integer env var", () => {
    process.env.MAX_GLOBAL_DAILY_CHAT_TURNS = "50";
    expect(getGlobalDailyChatTurnLimit()).toBe(50);
  });
});

describe("reserveChatTurn", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function rpcReturning(result: { data: unknown; error: { message: string } | null }) {
    return { rpc: vi.fn(() => Promise.resolve(result)) };
  }

  it("reserves through reserve_chat_turn with both daily caps", async () => {
    process.env.PER_USER_DAILY_CHAT_MESSAGES = "7";
    process.env.MAX_GLOBAL_DAILY_CHAT_TURNS = "70";
    const supabase = rpcReturning({ data: "turn-1", error: null });

    expect(await reserveChatTurn(supabase as never, "user-1")).toEqual({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith("reserve_chat_turn", {
      p_user_id: "user-1",
      p_per_user_cap: 7,
      p_global_cap: 70,
    });
  });

  it.each(["quota_exceeded", "global_cap_reached"])("maps %s to a refusal", async (reason) => {
    const supabase = rpcReturning({ data: null, error: { message: reason } });
    expect(await reserveChatTurn(supabase as never, "user-1")).toEqual({ ok: false, reason });
  });

  it("rethrows any other error", async () => {
    const supabase = rpcReturning({ data: null, error: { message: "boom" } });
    await expect(reserveChatTurn(supabase as never, "user-1")).rejects.toThrow(/boom/);
  });
});

describe("MAX_MESSAGE_CHARS", () => {
  it("is a sane positive cap", () => {
    expect(MAX_MESSAGE_CHARS).toBeGreaterThan(500);
    expect(MAX_MESSAGE_CHARS).toBeLessThan(20000);
  });
});
