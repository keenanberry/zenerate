import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { StudioUIMessage } from "@/lib/chat/tools";

const { mockGetUser, mockLoadChat, mockLoadMessages, mockSaveMessages, mockTouchChat, mockCount, model } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockLoadChat: vi.fn(),
    mockLoadMessages: vi.fn(),
    mockSaveMessages: vi.fn(),
    mockTouchChat: vi.fn(),
    mockCount: vi.fn(),
    model: { current: null as unknown },
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: () => model.current,
}));
vi.mock("@/lib/chat/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat/store")>();
  return {
    ...actual,
    loadChat: mockLoadChat,
    loadMessages: mockLoadMessages,
    saveMessages: mockSaveMessages,
    touchChat: mockTouchChat,
  };
});
vi.mock("@/lib/ai/quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/quota")>();
  return { ...actual, countRecentUserMessages: mockCount };
});

import { POST } from "./route";
import { STUDIO_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";

function textModel(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: text },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

function userMessage(text: string, id = "client-1"): StudioUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function post(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function drain(res: Response) {
  await res.text();
  // onEnd runs as the stream closes; let its awaits settle.
  await new Promise((r) => setTimeout(r, 0));
}

describe("POST /api/chat", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    model.current = textModel("Here is a meditation to unwind.");
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockLoadChat.mockResolvedValue({ id: CHAT_ID, user_id: "user-1", meditation_id: null, title: null });
    mockLoadMessages.mockResolvedValue([]);
    mockSaveMessages.mockResolvedValue(undefined);
    mockTouchChat.mockResolvedValue(undefined);
    mockCount.mockResolvedValue(0);
    delete process.env.PER_USER_DAILY_CHAT_MESSAGES;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("hi") }));
    expect(res.status).toBe(401);
    expect(mockLoadChat).not.toHaveBeenCalled();
  });

  it("returns 404 on a chat the caller cannot see", async () => {
    // Another user's chat: RLS returns no row.
    mockLoadChat.mockResolvedValue(null);
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("hi") }));
    expect(res.status).toBe(404);
    expect(mockSaveMessages).not.toHaveBeenCalled();
  });

  it("returns 400 without a chat id or message", async () => {
    expect((await POST(post({ message: userMessage("hi") }))).status).toBe(400);
    expect((await POST(post({ chatId: "not-a-uuid", message: userMessage("hi") }))).status).toBe(400);
    expect((await POST(post({ chatId: CHAT_ID }))).status).toBe(400);
  });

  it("returns 400 on a new message that is not from the user", async () => {
    const res = await POST(
      post({ chatId: CHAT_ID, message: { id: "x", role: "assistant", parts: [{ type: "text", text: "hi" }] } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on an over-long message", async () => {
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("x".repeat(5000)) }));
    expect(res.status).toBe(400);
  });

  it("returns 429 at the daily ceiling, without calling the model", async () => {
    process.env.PER_USER_DAILY_CHAT_MESSAGES = "3";
    mockCount.mockResolvedValue(3);
    const spy = vi.spyOn(model.current as MockLanguageModelV4, "doStream");
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("hi") }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/tomorrow/);
    expect(spy).not.toHaveBeenCalled();
    expect(mockSaveMessages).not.toHaveBeenCalled();
  });

  it("streams under the ceiling and saves the user and assistant messages", async () => {
    mockCount.mockResolvedValue(2);
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("10 minutes to unwind") }));
    expect(res.status).toBe(200);
    await drain(res);

    // The user message first, under a server id, before the model runs.
    const [firstSave] = mockSaveMessages.mock.calls[0].slice(2) as [StudioUIMessage[]];
    expect(firstSave).toHaveLength(1);
    expect(firstSave[0].role).toBe("user");
    expect(firstSave[0].id).toMatch(/^msg/);

    // Then the finished turn, with the assistant reply.
    const [final] = mockSaveMessages.mock.calls.at(-1)!.slice(2) as [StudioUIMessage[]];
    const assistant = final.find((m) => m.role === "assistant");
    expect(assistant?.id).toMatch(/^msg/);
    expect(assistant?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "Here is a meditation to unwind." }),
    );
  });

  it("sends the studio prompt as instructions, with the tools and a step limit", async () => {
    const res = await POST(post({ chatId: CHAT_ID, message: userMessage("hi") }));
    await drain(res);
    const call = (model.current as MockLanguageModelV4).doStreamCalls[0];
    expect(call.prompt[0]).toMatchObject({ role: "system", content: STUDIO_SYSTEM_PROMPT });
    expect(call.tools?.map((t) => t.name).sort()).toEqual(["offerAudio", "previewSounds", "setDetails", "writeScript"]);
    expect(call.maxOutputTokens).toBeGreaterThan(0);
    // setDetails must not run before the writeScript that creates the meditation.
    expect(call.providerOptions?.anthropic).toMatchObject({ disableParallelToolUse: true });
  });

  it("continues a stored assistant message when a client tool result comes back", async () => {
    const assistant: StudioUIMessage = {
      id: "msg-assistant",
      role: "assistant",
      parts: [{ type: "tool-offerAudio", toolCallId: "call-1", state: "input-available", input: {} }],
    };
    mockLoadMessages.mockResolvedValue([userMessage("unwind", "msg-user"), assistant]);
    const answered: StudioUIMessage = {
      ...assistant,
      parts: [
        { type: "tool-offerAudio", toolCallId: "call-1", state: "output-available", input: {}, output: { outcome: "started", voice: "Sarah" } },
      ],
    };

    const res = await POST(post({ chatId: CHAT_ID, message: answered }));
    expect(res.status).toBe(200);
    await drain(res);

    const [final] = mockSaveMessages.mock.calls.at(-1)!.slice(2) as [StudioUIMessage[]];
    expect(final.map((m) => m.id)).toEqual(["msg-assistant"]);
    expect(final[0].parts.length).toBeGreaterThan(1);
  });
});
