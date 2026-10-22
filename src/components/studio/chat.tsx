"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, FileText, Loader2, RotateCcw, Square, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_CHARS } from "@/lib/ai/quota";
import { MAKE_AUDIO_REPLY } from "@/lib/chat/replies";
import type { StudioUIMessage } from "@/lib/chat/tools";
import { cn } from "@/lib/utils";
import { minutesLabel, showsQuickReplies, type Draft, type StudioPart } from "./drafts";
import { renderStudioPart } from "./parts";
import { QuickReplies } from "./quick-replies";
import { useStudio } from "./studio-context";
import { useFollowScroll } from "./use-follow-scroll";

/** Compact stand-in for a script in the chat; the script itself lives in the canvas. */
function DraftChip({ draft, live }: { draft: Draft | undefined; live: boolean }) {
  const { openCanvas } = useStudio();

  if (!draft) {
    // A writeScript the server refused. The agent says why in its reply.
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <TriangleAlert className="size-3.5 shrink-0 text-candle" aria-hidden />
        This draft could not be saved.
      </p>
    );
  }

  const writing = !draft.saved && live;
  const length = draft.estimate
    ? minutesLabel(draft.estimate.estimatedSeconds)
    : draft.durationMinutes
      ? `${draft.durationMinutes} min`
      : null;

  return (
    <button
      type="button"
      onClick={openCanvas}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md border bg-card px-3 py-2 text-sm font-medium",
        "hover:bg-card-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "motion-safe:transition-colors",
      )}
    >
      {writing ? (
        <Loader2 className="size-4 text-primary motion-safe:animate-spin" aria-hidden />
      ) : (
        <FileText className="size-4 text-primary" aria-hidden />
      )}
      <span>
        {writing ? `Writing draft ${draft.number}` : `Draft ${draft.number}`}
        {length && <span className="text-muted-foreground tabular-nums"> · {length}</span>}
      </span>
      {!draft.saved && !live && <span className="text-candle">Not saved</span>}
    </button>
  );
}

function MessagePart({
  part,
  drafts,
  live,
}: {
  part: StudioPart;
  drafts: Map<string, Draft>;
  live: boolean;
}): ReactNode {
  switch (part.type) {
    case "text":
      return part.text.trim() ? (
        <p className="wrap-break-word whitespace-pre-wrap">{part.text}</p>
      ) : null;
    case "tool-writeScript":
      return <DraftChip draft={drafts.get(part.toolCallId)} live={live} />;
    case "tool-setDetails":
      return part.state === "output-available" ? (
        <p className="text-sm text-muted-foreground">
          Named it <span className="font-serif text-foreground">{part.output.title}</span>
        </p>
      ) : null;
    default:
      return renderStudioPart(part);
  }
}

function Message({
  message,
  drafts,
  live,
}: {
  message: StudioUIMessage;
  drafts: Map<string, Draft>;
  live: boolean;
}) {
  if (message.role === "user") {
    const text = message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
    return (
      <div className="ml-auto max-w-[85%] rounded-xl bg-secondary px-4 py-2.5 wrap-break-word whitespace-pre-wrap text-secondary-foreground">
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message.parts.map((part, i) => {
        const rendered = <MessagePart part={part} drafts={drafts} live={live} />;
        return rendered ? <div key={i}>{rendered}</div> : null;
      })}
    </div>
  );
}

function Thinking() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      Thinking
    </p>
  );
}

interface ChatProps {
  messages: StudioUIMessage[];
  drafts: Draft[];
  live: boolean;
  /** Waiting on the first token: nothing of the reply is on screen yet. */
  thinking: boolean;
  error: { message: string; rateLimited: boolean } | null;
  /** The last saved message is a request with no reply: the turn may still be running. */
  unanswered: boolean;
  /** Sits above the composer on a phone: the "Script updated" pill. */
  pill?: ReactNode;
  onSend: (text: string) => void;
  onRetry: () => void;
  onStop: () => void;
  className?: string;
}

export function Chat({
  messages,
  drafts,
  live,
  thinking,
  error,
  unanswered,
  pill,
  onSend,
  onRetry,
  onStop,
  className,
}: ChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { scrollToEnd } = useFollowScroll(scrollRef, contentRef);
  const byId = new Map(drafts.map((d) => [d.toolCallId, d]));

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || live) return;
    onSend(text);
    setInput("");
    scrollToEnd();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter breaks the line, except mid-composition
    // (an IME's Enter picks a candidate, it does not mean "send").
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Scrolls one way only. Overflow on one axis makes the other `auto`
          too, so the player's halo, which spills past its card by design,
          used to scroll the chat sideways. The 16px bleed into the gutter
          gives the halo and focus rings room before the clip, and the halo
          spills no further sideways than that, so the clip leaves no edge. */}
      <div
        ref={scrollRef}
        className="-mx-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 [&_.player-halo]:-inset-x-4!"
      >
        <div ref={contentRef} className="space-y-6 pb-6">
          {messages.map((message) => (
            <Message key={message.id} message={message} drafts={byId} live={live} />
          ))}
          {showsQuickReplies(messages, live) && (
            <QuickReplies
              onMakeAudio={() => {
                onSend(MAKE_AUDIO_REPLY);
                scrollToEnd();
              }}
              onChange={() => inputRef.current?.focus()}
            />
          )}
          {thinking && <Thinking />}
          {unanswered && !live && !error && (
            <div className="space-y-3 rounded-xl border bg-card px-5 py-4 text-sm">
              <p className="text-muted-foreground">
                The reply to this may still be on its way. Reload in a moment to see it.
              </p>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw aria-hidden />
                Reload
              </Button>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm"
            >
              <p>{error.message}</p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw aria-hidden />
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* In the flow, not floating, so it never covers the newest message. */}
      {pill && <div className="flex justify-center pt-3 md:hidden">{pill}</div>}
      <div className="pt-3">
        <form onSubmit={submit} className="relative">
          <label htmlFor="studio-message" className="sr-only">
            Message
          </label>
          <Textarea
            id="studio-message"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_MESSAGE_CHARS}
            rows={1}
            placeholder={messages.length ? "Ask for a change" : "Describe the meditation you want"}
            className="max-h-40 min-h-12 resize-none py-3 pr-14 text-base"
          />
          {live ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStop}
              className="absolute right-2 bottom-2 size-8"
              aria-label="Stop"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 size-8"
              aria-label="Send"
            >
              <ArrowUp aria-hidden />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
