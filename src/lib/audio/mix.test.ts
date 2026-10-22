import { describe, it, expect } from "vitest";
import { BED_FADE_IN_SECONDS, bedMixFilter, parseMediaSeconds } from "./mix";

describe("parseMediaSeconds", () => {
  it("reads the input's Duration line", () => {
    const stderr = `Input #0, mp3, from 'temp/voice-only.mp3':
  Duration: 00:12:03.48, start: 0.025057, bitrate: 192 kb/s
  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 192 kb/s`;
    expect(parseMediaSeconds(stderr)).toBeCloseTo(723.48);
  });

  it("returns null when ffmpeg does not know the length", () => {
    expect(parseMediaSeconds("  Duration: N/A, bitrate: N/A")).toBeNull();
    expect(parseMediaSeconds("")).toBeNull();
  });
});

describe("bedMixFilter", () => {
  it("keeps the narration at full level rather than letting amix halve it", () => {
    const graph = bedMixFilter(0.5, 600).join(";");
    expect(graph).toMatch(/amix=[^;]*normalize=0/);
  });

  it("ducks the bed under the narration and limits the sum", () => {
    const graph = bedMixFilter(0.5, 600).join(";");
    expect(graph).toContain("[music][key]sidechaincompress");
    expect(graph).toMatch(/amix=[^;]*duration=first[^;]*,alimiter=limit=0.891/);
  });

  it("fades the bed in at the start and out over the narration's last seconds", () => {
    const [, music] = bedMixFilter(0.5, 600);
    expect(music).toContain("volume=0.5");
    expect(music).toContain(`afade=t=in:d=${BED_FADE_IN_SECONDS}`);
    expect(music).toContain("afade=t=out:st=592.00:d=8.00");
  });

  it("shortens the fade-out for a short meditation", () => {
    const [, music] = bedMixFilter(0.5, 20);
    expect(music).toContain("afade=t=out:st=15.00:d=5.00");
  });

  it("skips the fade-out when the length is unknown", () => {
    const [, music] = bedMixFilter(0.5, null);
    expect(music).not.toContain("t=out");
  });
});
