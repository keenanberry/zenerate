"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { ArrowDown, Loader2, TriangleAlert } from "lucide-react";
import { ScriptViewer } from "@/components/script-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TAG_LABELS } from "@/lib/meditation/tags";
import { cn } from "@/lib/utils";
import { minutesLabel, type Details, type Draft } from "./drafts";
import { useFollowScroll } from "./use-follow-scroll";

interface ScriptCanvasProps {
  draft: Draft | null;
  details: Details | null;
  /** A turn is in flight, so an unsaved draft is still on its way. */
  live: boolean;
  /** Sits at the end of the header row: the sheet's close button. */
  action?: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** The status line: writing, or saved with its length against the target. */
function DraftStatus({ draft, live }: { draft: Draft; live: boolean }) {
  if (!draft.saved && !live) {
    // The turn ended (an error, a stop) before the server wrote this one.
    return (
      <span className="inline-flex items-center gap-1.5 text-candle">
        <TriangleAlert className="size-3" aria-hidden />
        Not saved
      </span>
    );
  }
  if (!draft.saved) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden />
        {draft.streaming ? "Writing" : "Saving"}
      </span>
    );
  }
  if (!draft.estimate) return <span>Saved</span>;

  const { estimatedSeconds, targetSeconds, withinTarget } = draft.estimate;
  const estimate = `About ${minutesLabel(estimatedSeconds)}`;
  if (withinTarget) {
    return <span className="tabular-nums">{estimate}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-candle tabular-nums">
      <TriangleAlert className="size-3" aria-hidden />
      {estimate}, {minutesLabel(targetSeconds)} asked
    </span>
  );
}

/**
 * The script as the agent writes it: the newest draft through the real
 * ScriptViewer, followed to its newest line while it streams. A draft is
 * only called saved once the server has written it; until then the status
 * says so.
 */
export function ScriptCanvas({ draft, details, live, action, className, ref }: ScriptCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // A script opened from a reload is read from the top; only one being
  // written is followed.
  const { following, scrollToEnd } = useFollowScroll(scrollRef, contentRef, live);
  const hasText = !!draft?.script.trim();

  // Each new draft starts from its first line, followed, even if the reader
  // had scrolled up in the one before.
  const draftId = draft?.toolCallId;
  const streaming = live && !!draft?.streaming;
  useEffect(() => {
    if (draftId && streaming) scrollToEnd();
  }, [draftId, streaming, scrollToEnd]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Script"
      className={cn(
        "relative flex min-h-0 flex-col rounded-xl border bg-card outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <header className="space-y-3 border-b px-6 pt-5 pb-4 sm:px-8">
        <div className="flex items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
          <span className="tracking-[0.06em] uppercase">
            {draft ? `Draft ${draft.number}` : "Script"}
          </span>
          <div className="flex items-center gap-3">
            {draft && (
              <span aria-live="polite">
                <DraftStatus draft={draft} live={live} />
              </span>
            )}
            {action}
          </div>
        </div>
        {details && (
          <div className="space-y-2.5">
            <h2 className="font-serif text-xl leading-tight font-medium text-balance">
              {details.title}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {details.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="px-6 py-6 sm:px-8 sm:py-8">
          {hasText ? (
            <ScriptViewer script={draft!.script} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {live && draft?.streaming
                ? "The first lines are on their way."
                : "Your script appears here as it is written."}
            </p>
          )}
        </div>
      </div>

      {live && draft?.streaming && !following && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={scrollToEnd}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 gap-1.5 bg-card"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          Follow the writing
        </Button>
      )}
    </section>
  );
}
