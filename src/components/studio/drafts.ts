import type { StudioUIMessage } from "@/lib/chat/tools";
import type { Tag } from "@/lib/meditation/tags";

export type StudioPart = StudioUIMessage["parts"][number];
export type WriteScriptPart = Extract<StudioPart, { type: "tool-writeScript" }>;
export type SetDetailsPart = Extract<StudioPart, { type: "tool-setDetails" }>;

/** One `writeScript` call as the canvas and the chat chips see it. */
export type Draft = {
  toolCallId: string;
  /** 1-based, counting only drafts that saved or are still being written. */
  number: number;
  script: string;
  durationMinutes: number | null;
  /** Written and saved by the server. Anything else is not yet a saved script. */
  saved: boolean;
  /** Still arriving from the model. */
  streaming: boolean;
  estimate: { estimatedSeconds: number; targetSeconds: number; withinTarget: boolean } | null;
};

export type Details = { title: string; tags: Tag[] };

/**
 * While the script streams, its last line can be a marker cut mid-way
 * (`*[PAU`), which the parser would read as speech or drop and then flash
 * back as a marker. Hold that line back until it is complete.
 */
export function trimPartialLine(script: string): string {
  const cut = script.lastIndexOf("\n");
  const last = script.slice(cut + 1).trim();
  if (!last.startsWith("*")) return script;
  return cut === -1 ? "" : script.slice(0, cut);
}

function isWriteScript(part: StudioPart): part is WriteScriptPart {
  return part.type === "tool-writeScript";
}

/**
 * Every draft in the conversation, oldest first. A call that failed
 * (`output-error`, say the server refused during a render) saved nothing, so
 * it gets no number and never reaches the canvas.
 */
export function collectDrafts(messages: StudioUIMessage[]): Draft[] {
  const drafts: Draft[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isWriteScript(part) || part.state === "output-error") continue;
      if (part.state === "approval-requested" || part.state === "approval-responded") continue;
      if (part.state === "output-denied") continue;
      const streaming = part.state === "input-streaming";
      const raw = part.input?.script ?? "";
      const output = part.state === "output-available" ? part.output : null;
      drafts.push({
        toolCallId: part.toolCallId,
        number: drafts.length + 1,
        script: streaming ? trimPartialLine(raw) : raw,
        durationMinutes: part.input?.durationMinutes ?? null,
        saved: output !== null,
        streaming,
        estimate: output
          ? {
              estimatedSeconds: output.estimatedSeconds,
              targetSeconds: output.targetSeconds,
              withinTarget: output.withinTarget,
            }
          : null,
      });
    }
  }
  return drafts;
}

/** The title and tags from the newest `setDetails` that ran. */
export function latestDetails(messages: StudioUIMessage[]): Details | null {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m].parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p];
      if (part.type === "tool-setDetails" && part.state === "output-available") {
        return { title: part.output.title, tags: part.output.tags };
      }
    }
  }
  return null;
}

/** "10 min", or "1 h 5 min" past an hour. Estimates round to the minute. */
export function minutesLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

/**
 * Read a failed request into one calm line. The transport puts the response
 * body in `message`, which for /api/chat is `{ "error": "..." }`.
 */
export function describeChatError(error: Error & { statusCode?: number }): {
  message: string;
  rateLimited: boolean;
} {
  let message = error.message;
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    if (typeof body.error === "string") message = body.error;
  } catch {
    // Not JSON: a stream error carries the route's own sentence already.
  }
  const rateLimited = error.statusCode === 429;
  if (!rateLimited && (!message || message.startsWith("{") || message.length > 200)) {
    message = "Something went wrong on our side. Try sending that again.";
  }
  return { message, rateLimited };
}
