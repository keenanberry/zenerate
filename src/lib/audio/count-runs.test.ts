import { describe, it, expect } from "vitest";
import { parseMeditationText } from "@/lib/meditation/parser";
import type { MeditationSegment } from "@/lib/meditation/types";
import {
  MAX_RUN_BEATS,
  MAX_RUN_BREAK_SECONDS,
  beatNumber,
  mergeCountRuns,
  splitRun,
} from "./count-runs";

const pause = (s: number) => `*[PAUSE: ${s} seconds]*`;
const NUMBERS = ["Ten.", "Nine.", "Eight.", "Seven.", "Six.", "Five.", "Four.", "Three.", "Two.", "One."];

/** A script the way the studio writes it: one line each, blank lines between. */
const script = (...lines: string[]) => lines.join("\n\n");

const countdown = script(
  "Let's count down together, from ten to one.",
  pause(2),
  ...NUMBERS.flatMap((n) => [n, pause(2)]),
  "Rest here.",
);

function speech(segments: MeditationSegment[]): string[] {
  return segments.flatMap((s) => (s.type === "speech" ? [s.content] : []));
}

describe("beatNumber", () => {
  it("reads a beat of a count", () => {
    expect(beatNumber("Ten.")).toBe(10);
    expect(beatNumber("And nine…")).toBe(9);
    expect(beatNumber("Breathe in, one.")).toBe(1);
    expect(beatNumber("4.")).toBe(4);
    expect(beatNumber("Twenty!")).toBe(20);
  });

  it("refuses prose, chained numbers and markup", () => {
    expect(beatNumber("Let's count down together, from ten to one.")).toBeNull();
    expect(beatNumber("Rest here.")).toBeNull();
    expect(beatNumber("One, two, three.")).toBeNull();
    expect(beatNumber("Breathe in for four.")).toBeNull();
    expect(beatNumber('Ten. <break time="2s" /> Nine.')).toBeNull();
    expect(beatNumber("")).toBeNull();
  });
});

describe("mergeCountRuns", () => {
  it("merges a countdown into one request with each PAUSE as a break", () => {
    const out = mergeCountRuns(parseMeditationText(countdown));
    expect(out).toEqual([
      { type: "speech", content: "Let's count down together, from ten to one." },
      { type: "pause", duration: 2 },
      {
        type: "speech",
        content: NUMBERS.join(' <break time="2s" /> '),
      },
      { type: "pause", duration: 2 },
      { type: "speech", content: "Rest here." },
    ]);
  });

  it("keeps the total of pauses, so the audio runs as long as the script says", () => {
    const segments = parseMeditationText(countdown);
    const seconds = (list: MeditationSegment[]) =>
      list.reduce((sum, s) => sum + (s.type === "pause" ? s.duration : 0), 0) +
      speech(list).join(" ").split(/<break time="(\d+)s" \/>/).reduce((sum, part, i) => sum + (i % 2 ? Number(part) : 0), 0);
    expect(seconds(mergeCountRuns(segments))).toBe(seconds(segments));
  });

  it("uses each PAUSE's own seconds", () => {
    const out = mergeCountRuns(parseMeditationText(script("One.", pause(1), "Two.", pause(3), "Three.", pause(1), "Four.")));
    expect(speech(out)).toEqual(['One. <break time="1s" /> Two. <break time="3s" /> Three. <break time="1s" /> Four.']);
  });

  it("merges a spoken breath count that starts again at one", () => {
    const out = mergeCountRuns(
      parseMeditationText(
        script("Breathe in, one.", pause(1), "Two.", pause(1), "Three.", pause(1), "Hold, one.", pause(1), "Two."),
      ),
    );
    expect(out).toHaveLength(1);
  });

  it("leaves a script with no count unchanged", () => {
    const segments = parseMeditationText(script("Welcome.", pause(2), "Breathe in for four.", pause(4), "Rest here."));
    expect(mergeCountRuns(segments)).toEqual(segments);
  });

  describe("does not merge", () => {
    it("a run of two", () => {
      const segments = parseMeditationText(script("Two.", pause(2), "One.", pause(2), "Rest here."));
      expect(mergeCountRuns(segments)).toEqual(segments);
    });

    it("short lines with numbers that are not a count", () => {
      const segments = parseMeditationText(
        script("Take one breath.", pause(2), "Five more.", pause(2), "Just two.", pause(2), "Rest here."),
      );
      expect(mergeCountRuns(segments)).toEqual(segments);
    });

    it("across a PAUSE longer than a break can be", () => {
      const segments = parseMeditationText(script("Three.", pause(2), "Two.", pause(4), "One."));
      expect(mergeCountRuns(segments)).toEqual(segments);
    });

    it("across a SILENCE or a SOUND", () => {
      const withSilence = parseMeditationText(
        script("Four.", pause(2), "Three.", "*[SILENCE: 1 minute]*", "Two.", pause(2), "One."),
      );
      expect(mergeCountRuns(withSilence)).toEqual(withSilence);
      const withSound = parseMeditationText(
        script("Four.", pause(2), "Three.", "*[SOUND: bell-tibetan.mp3]*", "Two.", pause(2), "One."),
      );
      expect(mergeCountRuns(withSound)).toEqual(withSound);
    });

    it("across a sentence between beats", () => {
      const segments = parseMeditationText(
        script("Three.", pause(2), "Feel your breath.", pause(2), "Two.", pause(2), "One."),
      );
      expect(mergeCountRuns(segments)).toEqual(segments);
    });
  });

  it("merges only the part of a longer stretch that is a count", () => {
    const out = mergeCountRuns(
      parseMeditationText(script("Three.", pause(4), "Three.", pause(2), "Two.", pause(2), "One.", pause(5), "Rest.")),
    );
    expect(out).toEqual([
      { type: "speech", content: "Three." },
      { type: "pause", duration: 4 },
      { type: "speech", content: 'Three. <break time="2s" /> Two. <break time="2s" /> One.' },
      { type: "pause", duration: 5 },
      { type: "speech", content: "Rest." },
    ]);
  });

  it("splits a count from twenty into requests within the limits, joined by their PAUSE", () => {
    const words = ["Twenty", "Nineteen", "Eighteen", "Seventeen", "Sixteen", "Fifteen", "Fourteen", "Thirteen", "Twelve", "Eleven"];
    const lines = [...words.map((w) => `${w}.`), ...NUMBERS];
    const out = mergeCountRuns(parseMeditationText(script(...lines.flatMap((l, i) => (i < lines.length - 1 ? [l, pause(2)] : [l])))));
    expect(out.map((s) => s.type)).toEqual(["speech", "pause", "speech"]);
    expect(speech(out)[0]).toMatch(/^Twenty\. .* Eleven\.$/);
    expect(speech(out)[1]).toMatch(/^Ten\. .* One\.$/);
  });
});

describe("splitRun", () => {
  const beats = (n: number, pause: number) =>
    Array.from({ length: n }, (_, i) => ({ id: i, pauseAfter: i < n - 1 ? pause : undefined }));
  const breakSeconds = (chunk: { pauseAfter?: number }[]) =>
    chunk.slice(0, -1).reduce((sum, b) => sum + (b.pauseAfter ?? 0), 0);

  it("keeps ten beats of 2 s in one request, as the operator heard it", () => {
    expect(splitRun(beats(10, 2))).toHaveLength(1);
  });

  it("splits evenly to stay within the beat and break-time limits", () => {
    expect(splitRun(beats(11, 1)).map((c) => c.length)).toEqual([6, 5]);
    expect(splitRun(beats(10, 3)).map((c) => c.length)).toEqual([5, 5]);
    expect(splitRun(beats(8, 3)).map((c) => c.length)).toEqual([4, 4]);
    for (const [n, p] of [[25, 1], [30, 3], [17, 2]] as const) {
      const chunks = splitRun(beats(n, p));
      expect(chunks.flat()).toHaveLength(n);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(MAX_RUN_BEATS);
        expect(breakSeconds(chunk)).toBeLessThanOrEqual(MAX_RUN_BREAK_SECONDS);
      }
    }
  });
});
