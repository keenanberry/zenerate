"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";

/** How long the thank-you stays before the prompt leaves on its own. */
export const THANKS_MS = 1800;

/**
 * The end-of-session rating card (card ZEN-6), after Insight Timer's: a calm
 * sheet that asks "How was this meditation?" under the title, with five
 * large stars. A tap saves at once, says thank you and goes; "Not now" and
 * the close button leave without rating.
 *
 * All of its styling lives here, so a restyle (the owner may send Insight
 * Timer references) touches this file alone. Two placements:
 * - `session`: inside the session view, always dark, over the player. It
 *   takes focus, and Escape closes it rather than the view.
 * - `page`: the session view was minimized, so a sheet at the foot of the
 *   page that leaves focus where it is.
 */
export function RatingPrompt({
  title,
  placement,
  rated = false,
  onRate,
  onClose,
}: {
  title: string;
  placement: "session" | "page";
  /**
   * Already rated through this prompt. Opening the session view moves the
   * prompt there, which mounts it afresh; this resumes the thank-you rather
   * than asking again.
   */
  rated?: boolean;
  /** Saves the stars; resolves false when the save failed. */
  onRate: (stars: number) => Promise<boolean>;
  /** `rated` is true after the thank-you, false on "Not now" or close. */
  onClose: (rated: boolean) => void;
}) {
  const [phase, setPhase] = useState<"ask" | "saving" | "thanks">(rated ? "thanks" : "ask");
  const [chosen, setChosen] = useState<number | null>(null);
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (placement === "session") panelRef.current?.focus();
  }, [placement]);

  useEffect(() => {
    if (phase !== "thanks") return;
    // The star that had focus is gone; keep it in the prompt so Escape and
    // Tab still work during the thank-you.
    if (placement === "session") panelRef.current?.focus();
    const timer = setTimeout(() => onClose(true), THANKS_MS);
    return () => clearTimeout(timer);
  }, [phase, onClose, placement]);

  async function rate(stars: number) {
    setChosen(stars);
    setPhase("saving");
    const saved = await onRate(stars);
    if (saved) {
      setPhase("thanks");
    } else {
      setChosen(null);
      setPhase("ask");
    }
  }

  const dismiss = () => onClose(phase === "thanks");

  return (
    <div
      data-rating-prompt
      className={cn(
        placement === "session"
          ? "absolute inset-0 z-10 flex items-end bg-night/70 backdrop-blur-sm sm:items-center sm:px-4"
          : "fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={placement === "session"}
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            dismiss();
          }
        }}
        className={cn(
          "relative mx-auto w-full max-w-md border bg-card px-6 pt-10 text-center text-card-foreground outline-none",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300",
          placement === "session"
            ? "rounded-t-2xl border-x-0 border-b-0 pb-[max(2rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:border-x sm:border-b sm:pb-8"
            : "rounded-2xl pb-6",
        )}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
        >
          <X className="size-5" />
        </button>

        <div aria-live="polite">
          {phase === "thanks" ? (
            <div className="space-y-2 py-6">
              <h2 id={headingId} className="font-serif text-2xl font-medium">
                Thank you
              </h2>
              <p className="text-sm text-muted-foreground">
                Your rating helps others find what helps them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
                Session complete
              </p>
              <h2 id={headingId} className="font-serif text-2xl font-medium text-balance">
                How was this meditation?
              </h2>
              <p className="truncate text-muted-foreground">{title}</p>
            </div>
          )}
        </div>

        {phase !== "thanks" && (
          <>
            <StarRating
              size="lg"
              value={chosen}
              onRate={rate}
              disabled={phase === "saving"}
              label={`Rate ${title}`}
              className="mt-6 justify-center gap-1"
            />
            <Button
              variant="ghost"
              onClick={dismiss}
              disabled={phase === "saving"}
              className="mt-4 text-muted-foreground"
            >
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
