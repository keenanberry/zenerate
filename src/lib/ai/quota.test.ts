import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  countRecentUserMessages,
  getDailyChatMessageLimit,
  MAX_MESSAGE_CHARS,
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

function makeCountSupabase(result: { count: number | null; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => Promise.resolve(result)),
  };
  return { from: vi.fn(() => query), query };
}

describe("countRecentUserMessages", () => {
  it("counts the user's own user-role messages over the last 24 hours", async () => {
    const supabase = makeCountSupabase({ count: 7, error: null });
    const now = new Date("2026-10-21T12:00:00Z");
    const n = await countRecentUserMessages(supabase as never, "user-1", now);

    expect(n).toBe(7);
    expect(supabase.from).toHaveBeenCalledWith("chat_messages");
    expect(supabase.query.eq).toHaveBeenCalledWith("chats.user_id", "user-1");
    expect(supabase.query.eq).toHaveBeenCalledWith("role", "user");
    expect(supabase.query.gte).toHaveBeenCalledWith("created_at", "2026-10-20T12:00:00.000Z");
  });

  it("rethrows a query error", async () => {
    const supabase = makeCountSupabase({ count: null, error: { message: "boom" } });
    await expect(countRecentUserMessages(supabase as never, "user-1")).rejects.toThrow(/boom/);
  });
});

describe("MAX_MESSAGE_CHARS", () => {
  it("is a sane positive cap", () => {
    expect(MAX_MESSAGE_CHARS).toBeGreaterThan(500);
    expect(MAX_MESSAGE_CHARS).toBeLessThan(20000);
  });
});
