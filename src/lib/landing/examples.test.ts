import { describe, expect, it } from "vitest";
import { parseMeditationText } from "@/lib/meditation/parser";
import { SOUND_EFFECTS } from "@/lib/meditation/sounds";
import { countWords } from "./stream";
import { DEMO_EXAMPLES, nextExample } from "./examples";

// The landing demo loops through these; every one must stream in about the
// same time and sit in the same card, so they share one shape.
describe("DEMO_EXAMPLES", () => {
  it("covers the six focuses the brainstorm settled on, in loop order", () => {
    expect(DEMO_EXAMPLES.map((e) => e.chip)).toEqual([
      "A hard conversation",
      "A new baby",
      "Loving-kindness",
      "A book I finished",
      "An anniversary",
      "Sleep after a shift",
    ]);
  });

  it("keeps every chip to four words: one row on a desktop, three rows of two at 390px", () => {
    for (const { chip } of DEMO_EXAMPLES) expect(countWords(chip)).toBeLessThanOrEqual(4);
  });

  it("writes each focus the way a person types it: lowercase start, no full stop", () => {
    for (const { focus } of DEMO_EXAMPLES) {
      expect(focus).toMatch(/^[a-z]/);
      expect(focus).not.toMatch(/\.$/);
    }
  });

  it("gives every script the same shape: one sound, three passages, two pauses, one silence", () => {
    for (const { chip, script } of DEMO_EXAMPLES) {
      const kinds = parseMeditationText(script).map((s) => s.type);
      expect(kinds, chip).toEqual(["sound", "speech", "pause", "speech", "pause", "speech", "silence"]);
    }
  });

  it("opens each example with a different sound that the pipeline has", () => {
    const sounds = DEMO_EXAMPLES.map(({ script }) => {
      const first = parseMeditationText(script)[0];
      return first.type === "sound" ? first.file : "";
    });
    expect(new Set(sounds).size).toBe(DEMO_EXAMPLES.length);
    for (const file of sounds) expect(Object.keys(SOUND_EFFECTS)).toContain(file);
  });

  it("keeps the scripts within a band, so each streams in about the same time and the card fits them all", () => {
    const counts = DEMO_EXAMPLES.map(({ script }) => countWords(script));
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(60);
    expect(Math.max(...counts)).toBeLessThanOrEqual(76);
  });
});

describe("nextExample", () => {
  it("advances through the list and wraps to the start", () => {
    expect(nextExample(0, 6)).toBe(1);
    expect(nextExample(4, 6)).toBe(5);
    expect(nextExample(5, 6)).toBe(0);
  });
});
