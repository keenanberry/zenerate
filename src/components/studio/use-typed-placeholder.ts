import { useEffect, useState, useSyncExternalStore } from "react";
import { DEMO_EXAMPLES } from "@/lib/landing/examples";

/**
 * The create page's placeholder types the landing examples one after another,
 * so the empty field reads as "anything like this" rather than one fixed
 * suggestion. The examples are the landing demo's requests, so the two
 * surfaces never disagree about what a request looks like.
 *
 * `next`, `textOf` and `delayOf` are pure and decide every frame; the hook
 * only runs them on a timer. The field shows `still` instead whenever the
 * loop is not running: on the server and before hydration, under
 * prefers-reduced-motion, and while the person has typed (the placeholder is
 * hidden then anyway, and the loop resumes where it left off if they clear
 * the field).
 */

export const PLACEHOLDER_EXAMPLES: readonly string[] = DEMO_EXAMPLES.map(
  (example) => example.request,
);

/** Milliseconds a frame stays on screen, by what the frame is doing. */
export const TYPE_MS = 48;
export const DELETE_MS = 18;
export const HOLD_MS = 2600;
export const REST_MS = 450;

export type Phase = "typing" | "holding" | "deleting" | "resting";

export interface TypingState {
  /** Which example is on screen. */
  index: number;
  /** How many of its characters are shown. */
  shown: number;
  phase: Phase;
}

/** The first frame: the first character of the first example. */
export const FIRST_STATE: TypingState = { index: 0, shown: 1, phase: "typing" };

export function textOf(state: TypingState, examples: readonly string[]): string {
  return (examples[state.index] ?? "").slice(0, state.shown);
}

export function delayOf(state: TypingState): number {
  switch (state.phase) {
    case "typing":
      return TYPE_MS;
    case "holding":
      return HOLD_MS;
    case "deleting":
      return DELETE_MS;
    case "resting":
      return REST_MS;
  }
}

/** The frame after `state`: one more character, the hold, one fewer, the rest, the next example. */
export function next(state: TypingState, examples: readonly string[]): TypingState {
  const length = (examples[state.index] ?? "").length;
  switch (state.phase) {
    case "typing":
      return state.shown + 1 >= length
        ? { ...state, shown: length, phase: "holding" }
        : { ...state, shown: state.shown + 1 };
    case "holding":
      return length > 1
        ? { ...state, shown: length - 1, phase: "deleting" }
        : { ...state, shown: 0, phase: "resting" };
    case "deleting":
      return state.shown <= 1
        ? { ...state, shown: 0, phase: "resting" }
        : { ...state, shown: state.shown - 1 };
    case "resting":
      return {
        index: examples.length ? (state.index + 1) % examples.length : 0,
        shown: 1,
        phase: "typing",
      };
  }
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

const noSubscription = () => () => {};

/**
 * The placeholder to show now. `examples` must be a stable array (a module
 * constant), or the loop restarts on every render.
 */
export function useTypedPlaceholder(
  examples: readonly string[],
  still: string,
  active: boolean,
): string {
  // Both read as false on the server and in the hydrating render, so the
  // server's `still` is what the client hydrates against.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
  const [frame, setFrame] = useState<TypingState>(FIRST_STATE);
  const running = hydrated && active && !reduced && examples.length > 0;

  // Each frame schedules the one after it; pausing keeps the frame, so the
  // loop resumes where it stopped.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setFrame((current) => next(current, examples)),
      delayOf(frame),
    );
    return () => window.clearTimeout(timer);
  }, [running, frame, examples]);

  return running ? textOf(frame, examples) : still;
}
