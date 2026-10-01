import { describe, it, expect } from "vitest";
import {
  estimateDuration,
  checkDuration,
  formatDuration,
  EFFECTIVE_WORDS_PER_MINUTE,
} from "./duration";

describe("estimateDuration", () => {
  it("counts pause seconds exactly", () => {
    const out = estimateDuration("*[PAUSE: 30 seconds]*\n*[PAUSE: 15 seconds]*");
    expect(out.pauseSeconds).toBe(45);
    expect(out.silenceSeconds).toBe(0);
  });

  it("converts silence minutes to seconds exactly", () => {
    const out = estimateDuration("*[SILENCE: 10 minutes]*\n*[SILENCE: 5 minutes]*");
    expect(out.silenceSeconds).toBe(900);
  });

  it("estimates speech from word count at the effective TTS rate", () => {
    // 128 words at ~127.5 wpm is almost exactly one minute.
    const words = Array(128).fill("breathe").join(" ");
    const out = estimateDuration(words);
    expect(out.speechSeconds).toBeGreaterThan(55);
    expect(out.speechSeconds).toBeLessThan(65);
  });

  it("totals all three components", () => {
    const script = [
      "Welcome to this practice.", // 4 words
      "*[PAUSE: 20 seconds]*",
      "*[SILENCE: 2 minutes]*",
    ].join("\n");
    const out = estimateDuration(script);

    expect(out.pauseSeconds).toBe(20);
    expect(out.silenceSeconds).toBe(120);
    expect(out.totalSeconds).toBe(out.speechSeconds + 140);
  });

  it("reports the speech ratio, which is what distinguishes a meditation from a monologue", () => {
    // Tiny bit of speech wrapped around a long silence.
    const out = estimateDuration("Settle in.\n*[SILENCE: 20 minutes]*");
    expect(out.speechRatio).toBeLessThan(0.05);
  });

  it("handles an empty script without dividing by zero", () => {
    const out = estimateDuration("");
    expect(out.totalSeconds).toBe(0);
    expect(out.speechRatio).toBe(0);
  });

  it("ignores markers the parser drops, matching what would actually be rendered", () => {
    // parser.ts silently drops a malformed marker, so neither its timing nor
    // its line contributes. The estimate must agree with the parser rather
    // than with the author's intent, or it would promise time that the audio
    // pipeline never produces.
    const out = estimateDuration("*[PAUSE: 3s]*");
    expect(out.totalSeconds).toBe(0);
  });

  it("uses a speech rate derived from the TTS speed setting", () => {
    // 150 wpm base x 0.85 speed, matching generate-audio.ts.
    expect(EFFECTIVE_WORDS_PER_MINUTE).toBeCloseTo(127.5, 1);
  });
});

describe("checkDuration", () => {
  it("is within tolerance when the script matches the request", () => {
    const script = "*[SILENCE: 10 minutes]*";
    const out = checkDuration(script, 10);

    expect(out.ratio).toBeCloseTo(1, 1);
    expect(out.withinTolerance).toBe(true);
  });

  it("flags a script that is far short", () => {
    // The measured pre-fix failure: ~70% of a 30-minute request.
    const out = checkDuration("*[SILENCE: 21 minutes]*", 30);

    expect(out.ratio).toBeCloseTo(0.7, 1);
    expect(out.withinTolerance).toBe(false);
  });

  it("flags a script that is far over", () => {
    const out = checkDuration("*[SILENCE: 45 minutes]*", 30);
    expect(out.withinTolerance).toBe(false);
  });

  it("accepts the edges of the +/-20% band", () => {
    expect(checkDuration("*[SILENCE: 24 minutes]*", 30).withinTolerance).toBe(true);
    expect(checkDuration("*[SILENCE: 36 minutes]*", 30).withinTolerance).toBe(true);
  });

  it("does not divide by zero on a zero target", () => {
    const out = checkDuration("*[SILENCE: 5 minutes]*", 0);
    expect(out.ratio).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(731)).toBe("12 min 11 sec");
  });

  it("omits seconds when whole", () => {
    expect(formatDuration(600)).toBe("10 min");
  });

  it("omits minutes when under one", () => {
    expect(formatDuration(45)).toBe("45 sec");
  });
});
