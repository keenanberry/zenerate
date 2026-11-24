import { describe, it, expect } from "vitest";
import { NEAR_SILENT_PEAK_DB, hasSpeakableText, isNearSilent, parseMaxVolume } from "./clip-check";

// Trimmed stderr from `ffmpeg -i clip.mp3 -af volumedetect -f null -` on the
// silent "One." ElevenLabs returned on 2026-11-23.
const SILENT = `
[Parsed_volumedetect_0 @ 0x1] n_samples: 42768
[Parsed_volumedetect_0 @ 0x1] mean_volume: -70.7 dB
[Parsed_volumedetect_0 @ 0x1] max_volume: -52.0 dB
[Parsed_volumedetect_0 @ 0x1] histogram_52db: 3
`;
const SPOKEN = `
[Parsed_volumedetect_0 @ 0x1] mean_volume: -33.4 dB
[Parsed_volumedetect_0 @ 0x1] max_volume: -13.8 dB
`;

describe("parseMaxVolume", () => {
  it("reads the peak", () => {
    expect(parseMaxVolume(SILENT)).toBe(-52);
    expect(parseMaxVolume(SPOKEN)).toBe(-13.8);
    expect(parseMaxVolume("max_volume: 0.0 dB")).toBe(0);
  });

  it("reads digital silence as -Infinity", () => {
    expect(parseMaxVolume("[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB")).toBe(-Infinity);
  });

  it("is null when ffmpeg printed no peak", () => {
    expect(parseMaxVolume("")).toBeNull();
    expect(parseMaxVolume("mean_volume: -20.0 dB")).toBeNull();
  });
});

describe("hasSpeakableText", () => {
  it("checks a line with a word or a number", () => {
    expect(hasSpeakableText("One.")).toBe(true);
    expect(hasSpeakableText("4.")).toBe(true);
    expect(hasSpeakableText("Breathe.")).toBe(true);
    expect(hasSpeakableText("Ça va… respire.")).toBe(true);
    expect(hasSpeakableText('Ten. <break time="2s" /> Nine.')).toBe(true);
  });

  it("skips a line that is only punctuation, which may rightly be silent", () => {
    expect(hasSpeakableText("...")).toBe(false);
    expect(hasSpeakableText("—")).toBe(false);
    expect(hasSpeakableText(" … – ")).toBe(false);
    expect(hasSpeakableText("")).toBe(false);
  });
});

describe("isNearSilent", () => {
  it("flags a clip that never reaches the threshold", () => {
    expect(isNearSilent(-52)).toBe(true);
    expect(isNearSilent(-Infinity)).toBe(true);
    expect(isNearSilent(NEAR_SILENT_PEAK_DB - 0.1)).toBe(true);
  });

  it("passes narration, the quietest heard included", () => {
    expect(isNearSilent(-13.8)).toBe(false);
    expect(isNearSilent(-27.7)).toBe(false);
    expect(isNearSilent(NEAR_SILENT_PEAK_DB)).toBe(false);
  });

  it("passes a clip whose peak could not be measured", () => {
    expect(isNearSilent(null)).toBe(false);
  });
});
