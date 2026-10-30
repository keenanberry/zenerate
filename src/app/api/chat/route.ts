import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { STUDIO_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { MAX_MESSAGE_CHARS, reserveChatTurn } from "@/lib/ai/quota";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { loadChat, loadMessages, messageText, saveMessages, touchChat } from "@/lib/chat/store";
import {
  prepareStudioStep,
  MAX_STEPS_PER_TURN,
  studioTools,
  type StudioToolContext,
  type StudioUIMessage,
} from "@/lib/chat/tools";
import { narrowsToolsForAudio, studioModel, studioProviderOptions, usageLogLine } from "@/lib/chat/model";

// A turn can be several model calls (write, check, rewrite, set details), and
// a long script with thinking takes a while to stream.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

function isMessageShape(value: unknown): value is StudioUIMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.id === "string" && typeof m.role === "string" && Array.isArray(m.parts);
}

/**
 * A new user message rebuilt from its text alone, or null when it carries
 * anything else. The AI SDK would forward a file part (a PDF, an image, a
 * data URL) to the model and the store, past the character cap, which counts
 * only text; and providerMetadata is the provider's to write, not the
 * client's.
 */
function userTextMessage(incoming: StudioUIMessage, id: string): StudioUIMessage | null {
  const parts: { type: "text"; text: string }[] = [];
  for (const part of incoming.parts as unknown[]) {
    const p = part as Record<string, unknown> | null;
    if (p?.type !== "text" || typeof p.text !== "string" || "providerMetadata" in p) return null;
    parts.push({ type: "text", text: p.text });
  }
  return { id, role: "user", parts };
}

type OfferAudioPart = Extract<StudioUIMessage["parts"][number], { type: "tool-offerAudio" }>;

/**
 * The stored assistant message with the audio card's answer filled in, or
 * null when the client answered no open card. The client's copy is trusted
 * for nothing else: every other part, like the rest of the history, comes
 * from the store, so a forged assistant turn never reaches the model or the
 * saved chat. validateUIMessages then holds the answer to offerAudio's
 * output schema.
 */
function answeredCard(stored: StudioUIMessage, incoming: StudioUIMessage): StudioUIMessage | null {
  const answers = new Map<string, unknown>();
  for (const part of incoming.parts as unknown[]) {
    const p = part as Partial<OfferAudioPart> | null;
    if (p?.type === "tool-offerAudio" && p.state === "output-available" && typeof p.toolCallId === "string") {
      answers.set(p.toolCallId, p.output);
    }
  }

  let answered = 0;
  const parts = stored.parts.map((part) => {
    if (part.type !== "tool-offerAudio" || part.state !== "input-available" || !answers.has(part.toolCallId)) {
      return part;
    }
    answered++;
    return { ...part, state: "output-available", output: answers.get(part.toolCallId) } as OfferAudioPart;
  });
  return answered > 0 ? { ...stored, parts } : null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const chatId: unknown = body?.chatId;
  const incoming: unknown = body?.message;

  if (typeof chatId !== "string" || !UUID.test(chatId) || !isMessageShape(incoming)) {
    return NextResponse.json(
      { error: "chatId and message are required" },
      { status: 400 },
    );
  }

  // RLS hides other people's chats, so theirs and a missing one look alike.
  const chat = await loadChat(supabase, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const history = await loadMessages(supabase, chatId);

  // Two shapes arrive here. A new user message is appended under a server id.
  // The last assistant message coming back with a client-side tool result
  // (offerAudio) replaces the stored copy, and the agent continues it.
  const last = history.at(-1);
  const isContinuation =
    incoming.role === "assistant" && last?.role === "assistant" && last.id === incoming.id;

  if (!isContinuation && incoming.role !== "user") {
    return NextResponse.json({ error: "message must be a user message" }, { status: 400 });
  }

  const message =
    isContinuation && last
      ? answeredCard(last, incoming)
      : userTextMessage(incoming, generateMessageId());
  if (!message) {
    return NextResponse.json(
      {
        error: isContinuation
          ? "message must answer an open audio card"
          : "message may contain text only",
      },
      { status: 400 },
    );
  }
  if (messageText(message).length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `message must be ${MAX_MESSAGE_CHARS} characters or fewer` },
      { status: 400 },
    );
  }
  const candidate = isContinuation ? [...history.slice(0, -1), message] : [...history, message];

  let messages: StudioUIMessage[];
  try {
    messages = await validateUIMessages<StudioUIMessage>({
      messages: candidate,
      tools: studioTools,
    });
  } catch {
    return NextResponse.json({ error: "message is not valid" }, { status: 400 });
  }

  // Every request runs the model, so every request reserves a turn, a
  // continuation included. The ledger is the service role's alone: nothing
  // the owner can delete or edit changes the count.
  const service = createServiceClient();
  const turn = await reserveChatTurn(service, user.id);
  if (!turn.ok) {
    return turn.reason === "quota_exceeded"
      ? NextResponse.json(
          {
            error:
              "You've sent a lot of messages today. Take a breather, and pick this up again tomorrow.",
          },
          { status: 429 },
        )
      : NextResponse.json(
          { error: "The studio is busy right now. Try again in a little while." },
          { status: 503 },
        );
  }

  // Saved before the model runs, so a failed turn still leaves the request
  // in the history. Messages are written on the service role: the owner
  // reads their chat and writes none of it, and loadChat above has already
  // shown, through RLS, that this chat is theirs.
  const firstUser = messages.find((m) => m.role === "user");
  const firstRequest = firstUser ? messageText(firstUser) : null;
  await saveMessages(service, chatId, [message]);
  await touchChat(supabase, chat, firstRequest);

  const toolContext: StudioToolContext = {
    supabase,
    userId: user.id,
    chatId,
  };

  const model = studioModel();
  const result = streamText({
    model: anthropic(model),
    // A cache breakpoint on the system prompt caches tools + prompt (~3k
    // tokens), which every step of every turn re-sends.
    instructions: {
      role: "system",
      content: STUDIO_SYSTEM_PROMPT,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: await convertToModelMessages(messages, {
      tools: studioTools,
      // An offerAudio card the owner never answered has no result. Anthropic
      // rejects a tool call without one, so drop it from what the model sees.
      ignoreIncompleteToolCalls: true,
    }),
    tools: studioTools,
    toolsContext: { writeScript: toolContext, setDetails: toolContext },
    stopWhen: isStepCount(MAX_STEPS_PER_TURN),
    prepareStep: (step) => prepareStudioStep(step, { narrowTools: narrowsToolsForAudio(model) }),
    maxOutputTokens: 8000,
    providerOptions: studioProviderOptions(model),
    // Real cost per turn, for pricing (task 47): sum these over a chat.
    onEnd: ({ totalUsage, steps }) => {
      console.info("[chat] usage", JSON.stringify(usageLogLine(model, totalUsage, steps.length)));
    },
  });

  // Unawaited: the model keeps running if the tab closes, so the turn still
  // saves. consumeSseStream below does the same for the UI stream.
  result.consumeStream();

  const saved = new Set(history.map((m) => m.id));
  const continuedId = isContinuation ? message.id : null;

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId,
      onError: (error) => {
        console.error("[chat] stream error", error);
        Sentry.captureException(error, { tags: { area: "chat" } });
        return "Something went wrong on our side. Try sending that again.";
      },
      onEnd: async ({ messages: final }) => {
        try {
          // New messages, plus the continued one whose parts just grew.
          const changed = final.filter((m) => !saved.has(m.id) || m.id === continuedId);
          await saveMessages(service, chatId, changed);
          await touchChat(supabase, { id: chat.id, title: chat.title ?? firstRequest }, null);
        } catch (error) {
          console.error("[chat] saving the turn failed", error);
          Sentry.captureException(error, { tags: { area: "chat" } });
        }
      },
    }),
    consumeSseStream: consumeStream,
  });
}
