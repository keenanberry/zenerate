"use client";

import { useEffect, useRef, useState } from "react";
import { ScriptViewer } from "@/components/script-viewer";
import { nextExample, type DemoExample } from "@/lib/landing/examples";
import { countWords, revealWords } from "@/lib/landing/stream";
import { cn } from "@/lib/utils";

/** Paced like the real stream: a few words at a time, not a typewriter. */
const TICK_MS = 90;
const WORDS_PER_TICK = 2;
/** How long a finished script stays up before the next one streams. */
const HOLD_MS = 7000;
const FADE_MS = 700;

interface ScriptStreamDemoProps {
  /** In loop order; the first streams first. */
  examples: DemoExample[];
}

/**
 * The landing page's product surface: a request in a chat bubble, the script
 * streaming into the real ScriptViewer beneath it, and the agent's one-line
 * reply once it is in. Looped through the examples while it is on screen,
 * with a row of chips that name them and jump between them.
 *
 * It never blocks first paint and never shifts layout: the server renders
 * every finished script as an invisible sizer in one grid cell, so the card
 * has the height of the tallest before any JavaScript runs, and the streamed
 * copy is laid over it in the same cell. Under prefers-reduced-motion the CSS
 * shows the chosen example's sizer instead, the effect never starts a timer,
 * and the chips swap the script whole.
 */
export function ScriptStreamDemo({ examples }: ScriptStreamDemoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [words, setWords] = useState(0);
  const [fading, setFading] = useState(false);
  // The loop's own copy of the index, and a way for a chip to restart it,
  // so neither needs the effect (and its observer) to be re-created.
  const indexRef = useRef(0);
  const restartRef = useRef<() => void>(() => {});
  const example = examples[index];
  const total = countWords(example.script);
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
      const total = countWords(examples[indexRef.current].script);
      if (count < total) {
        count = Math.min(count + WORDS_PER_TICK, total);
        setWords(count);
        timer = setTimeout(step, TICK_MS);
        return;
      }
      timer = setTimeout(() => {
        setFading(true);
        timer = setTimeout(() => {
          indexRef.current = nextExample(indexRef.current, examples.length);
          setIndex(indexRef.current);
          count = 0;
          setWords(0);
          setFading(false);
          step();
        }, FADE_MS);
      }, HOLD_MS);
    }

    // A chip tap: the chosen example from its first word, now.
    restartRef.current = () => {
      clearTimeout(timer);
      timer = undefined;
      count = 0;
      setWords(0);
      setFading(false);
      if (visible) timer = setTimeout(step, TICK_MS);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && timer === undefined) timer = setTimeout(step, TICK_MS);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      restartRef.current = () => {};
    };
  }, [examples]);

  function choose(i: number) {
    indexRef.current = i;
    setIndex(i);
    // Under reduced motion this is the no-op left by the effect, and the
    // sizer for the chosen example simply becomes the visible one.
    restartRef.current();
  }

  const streamed = revealWords(example.script, words);

  return (
    <figure ref={ref} className="space-y-3">
      <div className="rounded-xl border bg-card px-6 py-6 text-card-foreground sm:px-8 sm:py-8">
        {/* The person's message, as the studio shows it. Every request sits in
            one cell so the bubble's height never changes between examples. */}
        <div className="grid">
          {examples.map((e, i) => (
            <p
              key={e.chip}
              className={cn(
                "max-w-[85%] self-start justify-self-end rounded-xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground [grid-area:1/1]",
                i !== index && "invisible",
              )}
            >
              {e.request}
            </p>
          ))}
        </div>
        <div className="mt-6 mb-6 flex items-center justify-between gap-4 text-xs font-medium tracking-[0.06em] uppercase">
          <p className="text-muted-foreground">Draft 1</p>
          {/* Under reduced motion the script is shown whole, so it reads Ready. */}
          <p aria-hidden className="shrink-0">
            <span className={cn("motion-reduce:hidden", done ? "text-sage" : "text-candle")}>
              {done ? "Ready" : "Writing"}
            </span>
            <span className="hidden text-sage motion-reduce:inline">Ready</span>
          </p>
        </div>
        <div className="grid" aria-hidden>
          {examples.map((e, i) => (
            <div
              key={e.chip}
              className={cn("invisible [grid-area:1/1]", i === index && "motion-reduce:visible")}
            >
              <ScriptViewer script={e.script} />
            </div>
          ))}
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
        {/* The agent's closing line, plain text as in the studio, once the
            draft is in. Its space is held from the start, sized to the
            longest reply, so its arrival shifts nothing. */}
        <div className="mt-6 grid border-t pt-5">
          {examples.map((e, i) => (
            <p
              key={e.chip}
              className={cn(
                "text-sm text-pretty [grid-area:1/1]",
                "motion-safe:transition-opacity motion-safe:duration-700",
                i === index && done ? fading && "opacity-0" : "invisible opacity-0",
                i === index && "motion-reduce:visible motion-reduce:opacity-100",
              )}
            >
              {e.reply}
            </p>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Example requests" className="flex flex-wrap gap-2 px-1">
        {examples.map((e, i) => (
          <button
            key={e.chip}
            type="button"
            aria-pressed={i === index}
            onClick={() => choose(i)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors",
              i === index
                ? "border-transparent bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-card-hover hover:text-foreground",
            )}
          >
            {e.chip}
          </button>
        ))}
      </div>
      <figcaption className="px-1 text-sm text-muted-foreground">
        An example from the studio, shortened to its opening: a request, the
        script arriving as it is written, and the reply. Pauses, silences and
        sounds are written in for the narration. Choose another request to see
        it.
      </figcaption>
    </figure>
  );
}
