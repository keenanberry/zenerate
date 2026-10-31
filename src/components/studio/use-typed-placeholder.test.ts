import { describe, expect, it } from "vitest";
import {
  DELETE_MS,
  FIRST_STATE,
  HOLD_MS,
  PLACEHOLDER_EXAMPLES,
  REST_MS,
  TYPE_MS,
  delayOf,
  next,
  textOf,
  type TypingState,
} from "./use-typed-placeholder";

/** Every frame from `start`, as text, until the loop returns to `start`. */
function cycle(start: TypingState, examples: readonly string[]): string[] {
  const frames = [textOf(start, examples)];
  let state = next(start, examples);
  while (
    state.index !== start.index ||
    state.shown !== start.shown ||
    state.phase !== start.phase
  ) {
    frames.push(textOf(state, examples));
    state = next(state, examples);
    if (frames.length > 1000) throw new Error("the loop never returned to its start");
  }
  return frames;
}

describe("the typed placeholder", () => {
  it("types each example in, holds it, deletes it, rests, and moves to the next", () => {
    expect(cycle(FIRST_STATE, ["ab", "c"])).toEqual([
      "a",
      "ab", // held
      "a",
      "", // resting
      "c",
      "c", // held: a one-character example goes straight to the rest
      "",
    ]);
  });

  it("shows only prefixes, and each full example once per loop", () => {
    const frames = cycle(FIRST_STATE, PLACEHOLDER_EXAMPLES);
    for (const frame of frames) {
      expect(PLACEHOLDER_EXAMPLES.some((example) => example.startsWith(frame))).toBe(true);
    }
    for (const example of PLACEHOLDER_EXAMPLES) {
      expect(frames.filter((frame) => frame === example)).toHaveLength(1);
    }
  });

  it("paces the frames: slow in, a long hold, fast out, a short rest", () => {
    expect(delayOf({ index: 0, shown: 1, phase: "typing" })).toBe(TYPE_MS);
    expect(delayOf({ index: 0, shown: 2, phase: "holding" })).toBe(HOLD_MS);
    expect(delayOf({ index: 0, shown: 1, phase: "deleting" })).toBe(DELETE_MS);
    expect(delayOf({ index: 0, shown: 0, phase: "resting" })).toBe(REST_MS);
    expect(DELETE_MS).toBeLessThan(TYPE_MS);
    expect(REST_MS).toBeLessThan(HOLD_MS);
  });

  it("survives an empty list without looping forever", () => {
    const state = next({ index: 0, shown: 0, phase: "resting" }, []);
    expect(textOf(state, [])).toBe("");
    expect(next(state, [])).toEqual({ index: 0, shown: 0, phase: "holding" });
  });

  it("takes its examples from the landing demo, each on one line", () => {
    expect(PLACEHOLDER_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const example of PLACEHOLDER_EXAMPLES) {
      expect(example).not.toMatch(/\n/);
      expect(example.length).toBeLessThanOrEqual(120);
    }
  });
});
