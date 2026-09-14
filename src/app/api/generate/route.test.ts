import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockReserve, mockStreamText } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockReserve: vi.fn(),
  mockStreamText: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createClient: () => ({}),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (id: string) => ({ id }),
}));
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => {
    mockStreamText(...args);
    return { toTextStreamResponse: () => new Response("script text", { status: 200 }) };
  },
}));
vi.mock("@/lib/ai/quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/quota")>();
  return { ...actual, reserveScriptGeneration: mockReserve };
});

import { POST } from "./route";
import { MAX_PROMPT_CHARS } from "@/lib/ai/quota";

function post(body: unknown) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockReserve.mockResolvedValue({ ok: true, eventId: "evt-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(401);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is not a string", async () => {
    const res = await POST(post({ prompt: 42 }));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt exceeds the character cap", async () => {
    const res = await POST(post({ prompt: "x".repeat(MAX_PROMPT_CHARS + 1) }));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 429 when the user is over quota", async () => {
    mockReserve.mockResolvedValue({ ok: false, reason: "quota_exceeded" });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(429);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 503 when the global cap is reached", async () => {
    mockReserve.mockResolvedValue({ ok: false, reason: "global_cap_reached" });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(503);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("streams when authenticated and within quota", async () => {
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });

  it("caps output tokens on the model call", async () => {
    await POST(post({ prompt: "make me a meditation" }));
    const args = mockStreamText.mock.calls[0][0] as { maxOutputTokens?: number };
    expect(args.maxOutputTokens).toBeGreaterThan(0);
  });
});
