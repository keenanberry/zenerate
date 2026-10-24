"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MeditationCover } from "@/components/meditation-cover";
import { ScriptViewer } from "@/components/script-viewer";
import { useFollowScroll } from "@/components/studio/use-follow-scroll";
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
 * with a row of plain text buttons that name them and jump between them.
 *
 * It never blocks first paint and never shifts layout. The script sits in a
 * window of fixed height that follows the newest line as it streams, the way
 * the studio canvas does, with earlier lines fading out under the top edge,
 * so the card stays short enough for the hero to fit the first screen. The
 * request and the closing line are short, so every one of them is rendered
 * invisibly in one grid cell and the card takes the longest before any
 * JavaScript runs. Under prefers-reduced-motion the CSS shows the start of
 * the chosen script instead, fading out under the bottom edge, the effect
 * never starts a timer, and the chips swap the script whole.
 */
export function ScriptStreamDemo({ examples }: ScriptStreamDemoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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
  const started = words > 0;

  // Off until a script starts streaming, so under reduced motion the window
  // stays on the opening lines. Each new script is followed from its first
  // word, even if the visitor scrolled up in the one before.
  const { scrollToEnd } = useFollowScroll(scrollRef, contentRef, false);
  useEffect(() => {
    if (started) scrollToEnd();
  }, [index, started, scrollToEnd]);

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
    // window simply shows the chosen script from its start.
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
        {/* The draft as the studio's chat shows it (task 50): a cover, then
            "Writing draft 1" with a spinner until the script is in. Under
            reduced motion the script is shown whole, so it reads Draft 1. */}
        <div className="mt-5 flex items-center gap-3">
          <span className="relative shrink-0">
            <MeditationCover id={`demo:${example.chip}`} tags={[]} title={example.chip} size={32} />
            {!done && (
              <span className="absolute inset-0 flex items-center justify-center motion-reduce:hidden">
                <Loader2 className="size-3.5 text-foreground motion-safe:animate-spin" aria-hidden />
              </span>
            )}
          </span>
          <p aria-hidden className="text-sm text-muted-foreground">
            <span className="motion-reduce:hidden">{done ? "Draft 1" : "Writing draft 1"}</span>
            <span className="hidden motion-reduce:inline">Draft 1</span>
          </p>
        </div>
        {/* A fixed window, so the card is one height whatever the script.
            The mask is an alpha ramp, not a colour: the One Gradient Rule
            is about the player's purple-to-rose and does not cover it. */}
        <div
          ref={scrollRef}
          aria-hidden
          className={cn(
            "mt-3 h-52 overflow-y-auto overscroll-auto [scrollbar-width:none]",
            "[mask-image:linear-gradient(to_bottom,transparent,black_2rem)]",
            "motion-reduce:[mask-image:linear-gradient(to_top,transparent,black_2rem)]",
          )}
        >
          {/* Padded by the fade's depth, so a script's first line starts
              below it rather than under it. */}
          <div
            ref={contentRef}
            className={cn(
              "pt-8 motion-reduce:hidden",
              "motion-safe:transition-opacity motion-safe:duration-700",
              fading && "opacity-0",
            )}
          >
            {streamed && <ScriptViewer script={streamed} />}
          </div>
          <div className="hidden pb-8 motion-reduce:block">
            <ScriptViewer script={example.script} />
          </div>
        </div>
        {/* The agent's closing line, plain text as in the studio, once the
            draft is in. Its space is held from the start, sized to the
            longest reply, so its arrival shifts nothing. */}
        <div className="mt-4 grid border-t pt-5">
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
      {/* Plain text, not pills: these switch the example, they are not tags. */}
      <div role="group" aria-label="Example requests" className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {examples.map((e, i) => (
          <button
            key={e.chip}
            type="button"
            aria-pressed={i === index}
            onClick={() => choose(i)}
            className={cn(
              "rounded-sm py-1.5 text-sm underline-offset-[6px] outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors",
              i === index
                ? "text-foreground underline decoration-primary decoration-2"
                : "text-muted-foreground hover:text-foreground",
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
