import { describe, it, expect } from "vitest";
import { waveformOf } from "./waveform";

describe("waveformOf", () => {
  it("reads peaks and duration from a generation_meta or a sandbox result", () => {
    expect(waveformOf({ tts_characters: 10, peaks: [0, 50, 100], duration: 12.5 })).toEqual({
      peaks: [0, 50, 100],
      duration: 12.5,
    });
  });

  it.each([
    ["nothing", null],
    ["a render from before peaks", { tts_characters: 10 }],
    ["peaks without a duration", { peaks: [50] }],
    ["a zero duration", { peaks: [50], duration: 0 }],
    ["an empty array", { peaks: [], duration: 3 }],
    ["a peak out of range", { peaks: [50, 101], duration: 3 }],
    ["a negative peak", { peaks: [50, -1], duration: 3 }],
    ["a NaN", { peaks: [50, Number.NaN], duration: 3 }],
    ["a string peak", { peaks: ["50"], duration: 3 }],
    ["peaks that are not an array", { peaks: "50,60", duration: 3 }],
    ["far too many peaks", { peaks: new Array(60_000).fill(10), duration: 3 }],
  ])("returns null for %s", (_, source) => {
    expect(waveformOf(source)).toBeNull();
  });
});
