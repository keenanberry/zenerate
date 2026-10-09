"use client";

import { useEffect, useRef, useState } from "react";
import { ScriptViewer } from "@/components/script-viewer";
import { countWords, revealWords } from "@/lib/landing/stream";
import { cn } from "@/lib/utils";

/** Paced like the real stream: a few words at a time, not a typewriter. */
const TICK_MS = 90;
const WORDS_PER_TICK = 2;
/** How long the finished script stays up before the loop starts again. */
const HOLD_MS = 7000;
const FADE_MS = 700;

interface ScriptStreamDemoProps {
  /** Shown above the script, as the create page's prompt. */
  focus: string;
  script: string;
}

/**
 * The landing page's product surface: a script streaming into the real
 * ScriptViewer, looped while it is on screen.
 *
 * It never blocks first paint and never shifts layout: the server renders the
 * finished script as an invisible sizer, so the card has its final height
 * before any JavaScript runs, and the streamed copy is laid over it in the
 * same grid cell. Under prefers-reduced-motion the CSS shows the sizer
 * instead and the effect never starts a timer.
 */
export function ScriptStreamDemo({ focus, script }: ScriptStreamDemoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState(0);
  const [fading, setFading] = useState(false);
  const total = countWords(script);
  const done = words >= total;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const node = ref.current;
    if (reduce.matches || !node) return;

    let count = 0;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function step() {
      timer = undefined;
      // Stop while off screen or once the visitor asks for less motion; the
      // observer restarts it on the way back into view.
      if (!visible || reduce.matches) return;
      if (count < total) {
        count = Math.min(count + WORDS_PER_TICK, total);
        setWords(count);
        timer = setTimeout(step, TICK_MS);
        return;
      }
      timer = setTimeout(() => {
        setFading(true);
        timer = setTimeout(() => {
          count = 0;
          setWords(0);
          setFading(false);
          step();
        }, FADE_MS);
      }, HOLD_MS);
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && timer === undefined) timer = setTimeout(step, TICK_MS);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [total]);

  const streamed = revealWords(script, words);

  return (
    <figure ref={ref} className="space-y-3">
      <div className="rounded-xl border bg-card px-6 py-6 text-card-foreground sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-4 text-xs font-medium">
          <p className="min-w-0 truncate text-muted-foreground">
            <span className="tracking-[0.06em] uppercase">Focus</span>{" "}
            <span className="text-foreground">{focus}</span>
          </p>
          {/* Under reduced motion the script is shown whole, so it reads Ready. */}
          <p aria-hidden className="shrink-0 tracking-[0.06em] uppercase">
            <span className={cn("motion-reduce:hidden", done ? "text-sage" : "text-candle")}>
              {done ? "Ready" : "Writing"}
            </span>
            <span className="hidden text-sage motion-reduce:inline">Ready</span>
          </p>
        </div>
        <div className="grid" aria-hidden>
          <div className="invisible [grid-area:1/1] motion-reduce:visible">
            <ScriptViewer script={script} />
          </div>
          <div
            className={cn(
              "[grid-area:1/1] motion-reduce:hidden",
              "motion-safe:transition-opacity motion-safe:duration-700",
              fading && "opacity-0",
            )}
          >
            {streamed && <ScriptViewer script={streamed} />}
          </div>
        </div>
      </div>
      <figcaption className="px-1 text-sm text-muted-foreground">
        An example of a script arriving, as it does on the create page. Pauses,
        silences and sounds are written into it for the narration.
      </figcaption>
    </figure>
  );
}
