import { describe, it, expect } from "vitest";
import {
  NARRATION_TARGET_LUFS,
  narrationGainDb,
  parseIntegratedLoudness,
} from "./loudness";

// Trimmed real stderr from `ffmpeg -af ebur128 -f null -`. Per-frame lines
// also contain "I:", so the parser must read the Summary block, not the
// last frame.
const STDERR = `
[Parsed_ebur128_0 @ 0x1] t: 6.2      TARGET:-23 LUFS    M: -26.1 S: -27.0     I: -28.0 LUFS       LRA:   3.1 LU
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -27.3 LUFS
    Threshold: -37.9 LUFS

  Loudness range:
    LRA:         3.4 LU
`;

describe("parseIntegratedLoudness", () => {
  it("reads integrated loudness from the Summary block", () => {
    expect(parseIntegratedLoudness(STDERR)).toBe(-27.3);
  });

  it("reads the last Summary block when ffmpeg prints more than one", () => {
    // Real ffmpeg 6 output: an empty summary (-70 LUFS) is printed while the
    // filter graph is configured, before the real one at the end.
    const setup = STDERR.replace("-27.3 LUFS", "-70.0 LUFS");
    expect(parseIntegratedLoudness(setup + STDERR)).toBe(-27.3);
  });

  it("returns null when there is no summary", () => {
    expect(parseIntegratedLoudness("ffmpeg: error opening input")).toBeNull();
  });

  it("returns null for the -70 LUFS gating floor, which means no measurable audio", () => {
    const silent = STDERR.replace("-27.3 LUFS", "-70.0 LUFS");
    expect(parseIntegratedLoudness(silent)).toBeNull();
  });
});

describe("narrationGainDb", () => {
  it("raises quiet narration to the target", () => {
    // Brittney measured -33.6 LUFS straight from ElevenLabs.
    expect(narrationGainDb(-33.6)).toBeCloseTo(NARRATION_TARGET_LUFS + 33.6);
  });

  it("lowers loud narration to the target", () => {
    expect(narrationGainDb(-14)).toBeCloseTo(NARRATION_TARGET_LUFS + 14);
  });

  it("leaves audio untouched when loudness could not be measured", () => {
    expect(narrationGainDb(null)).toBe(0);
  });

  it("caps the boost, so near-silent speech is not amplified into noise", () => {
    expect(narrationGainDb(-60)).toBe(20);
  });
});
