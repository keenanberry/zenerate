import { describe, it, expect } from "vitest";
import type { MeditationSegment } from "./types";
import { EFFECTIVE_WORDS_PER_MINUTE } from "./duration";
import {
  activeSegmentIndex,
  lineState,
  segmentSpans,
  soundName,
} from "./timeline";

const words = (n: number) => Array(n).fill("breathe").join(" ");
const secondsFor = (n: number) => (n / EFFECTIVE_WORDS_PER_MINUTE) * 60;

const script: MeditationSegment[] = [
  { type: "speech", content: words(60) },
  { type: "pause", duration: 10 },
  { type: "sound", file: "gong-deep.mp3" },
  { type: "speech", content: words(30) },
  { type: "silence", duration: 120 },
];

describe("segmentSpans", () => {
  it("runs segments end to end in script order", () => {
    const spans = segmentSpans(script);
    expect(spans[0].start).toBe(0);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeCloseTo(spans[i - 1].end);
    }
  });

  it("gives pauses, silences and sounds their exact lengths", () => {
    const spans = segmentSpans(script);
    expect(spans[1].end - spans[1].start).toBe(10);
    expect(spans[2].end - spans[2].start).toBe(12);
    expect(spans[4].end - spans[4].start).toBe(120);
  });

  it("estimates speech from its word count without a known duration", () => {
    const spans = segmentSpans(script);
    expect(spans[0].end).toBeCloseTo(secondsFor(60));
    expect(spans[3].end - spans[3].start).toBeCloseTo(secondsFor(30));
  });

  it("scales only speech so the timeline ends with the audio", () => {
    const estimated = segmentSpans(script).at(-1)!.end;
    const spans = segmentSpans(script, estimated + 30);
    expect(spans.at(-1)!.end).toBeCloseTo(estimated + 30);
    // Exact parts keep their lengths; speech absorbs the 30s.
    expect(spans[1].end - spans[1].start).toBe(10);
    expect(spans[4].end - spans[4].start).toBe(120);
    const speech =
      spans[0].end - spans[0].start + (spans[3].end - spans[3].start);
    expect(speech).toBeCloseTo(secondsFor(90) + 30);
    // In proportion to the words: the 60-word passage gets twice the 30-word one.
    expect((spans[0].end - spans[0].start) / (spans[3].end - spans[3].start))
      .toBeCloseTo(2);
  });

  it("stretches everything evenly when the audio is shorter than its exact parts", () => {
    const spans = segmentSpans(script, 100);
    expect(spans.at(-1)!.end).toBeCloseTo(100);
    for (const s of spans) expect(s.end).toBeGreaterThanOrEqual(s.start);
  });

  it("stretches a script with no speech to the audio length", () => {
    const spans = segmentSpans(
      [
        { type: "pause", duration: 10 },
        { type: "silence", duration: 60 },
      ],
      140,
    );
    expect(spans[0].end).toBeCloseTo(20);
    expect(spans[1].end).toBeCloseTo(140);
  });

  it("ignores a duration that is not a positive number", () => {
    const plain = segmentSpans(script);
    expect(segmentSpans(script, 0)).toEqual(plain);
    expect(segmentSpans(script, NaN)).toEqual(plain);
    expect(segmentSpans(script, Infinity)).toEqual(plain);
  });

  it("returns nothing for an empty script", () => {
    expect(segmentSpans([], 60)).toEqual([]);
  });
});

describe("activeSegmentIndex", () => {
  const spans = [
    { start: 0, end: 10 },
    { start: 10, end: 15 },
    { start: 15, end: 40 },
  ];

  it("finds the segment containing the time, start inclusive", () => {
    expect(activeSegmentIndex(spans, 0)).toBe(0);
    expect(activeSegmentIndex(spans, 9.99)).toBe(0);
    expect(activeSegmentIndex(spans, 10)).toBe(1);
    expect(activeSegmentIndex(spans, 39)).toBe(2);
  });

  it("is -1 past the end", () => {
    expect(activeSegmentIndex(spans, 40)).toBe(-1);
  });
});

describe("lineState", () => {
  const spans = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ];

  it("is idle until playback starts", () => {
    expect(lineState(0, spans, 0, false)).toBe("idle");
    expect(lineState(1, spans, 15, false)).toBe("idle");
  });

  it("marks passed, current and upcoming once playing", () => {
    expect(lineState(0, spans, 12, true)).toBe("passed");
    expect(lineState(1, spans, 12, true)).toBe("current");
    expect(lineState(1, spans, 5, true)).toBe("upcoming");
  });

  it("is idle for an index with no span", () => {
    expect(lineState(5, spans, 5, true)).toBe("idle");
  });
});

describe("soundName", () => {
  it("reads catalog files as adjective then noun", () => {
    expect(soundName("gong-deep.mp3")).toBe("deep gong");
    expect(soundName("bowls-singing.mp3")).toBe("singing bowls");
    expect(soundName("bell-tibetan.mp3")).toBe("tibetan bell");
  });

  it("shows a file outside the catalog as written", () => {
    expect(soundName("thunder.mp3")).toBe("thunder.mp3");
  });
});
