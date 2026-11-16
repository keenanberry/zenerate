import { describe, it, expect } from "vitest";
import { PEAK_COUNT, PEAKS_SAMPLE_RATE, PeakReader } from "./peaks";

/** Interleaved stereo s16le, the format PEAKS_DECODE_ARGS asks ffmpeg for. */
function pcm(frames: Array<[number, number]>): Buffer {
  const buf = Buffer.alloc(frames.length * 4);
  frames.forEach(([l, r], i) => {
    buf.writeInt16LE(l, i * 4);
    buf.writeInt16LE(r, i * 4 + 2);
  });
  return buf;
}

function seconds(s: number, frame: (i: number) => [number, number]): Buffer {
  return pcm(Array.from({ length: Math.round(s * PEAKS_SAMPLE_RATE) }, (_, i) => frame(i)));
}

describe("PeakReader", () => {
  it("returns null for no audio", () => {
    expect(new PeakReader().finish()).toBeNull();
  });

  it("gives PEAK_COUNT peaks and the length in seconds", () => {
    const reader = new PeakReader();
    reader.push(seconds(60, () => [1000, -1000]));
    const result = reader.finish()!;
    expect(result.peaks).toHaveLength(PEAK_COUNT);
    expect(result.duration).toBe(60);
  });

  it("takes the loudest sample of either channel, as the decoded waveform's bars do", () => {
    const reader = new PeakReader();
    // Quiet left, a loud negative spike on the right halfway through.
    reader.push(seconds(60, (i) => [100, i === 240_000 ? -16384 : 0]));
    const { peaks } = reader.finish()!;
    expect(Math.max(...peaks)).toBe(50);
    expect(peaks[PEAK_COUNT / 2]).toBe(50);
    expect(peaks[0]).toBe(0);
  });

  it("gives whole percents of full scale, plenty for bars a few dozen pixels tall", () => {
    const reader = new PeakReader();
    reader.push(seconds(60, () => [12345, 0]));
    expect(new Set(reader.finish()!.peaks)).toEqual(new Set([38]));
  });

  it("reads the same whatever the chunking, including a chunk split mid-sample", () => {
    const audio = seconds(13.7, (i) => [Math.round(Math.sin(i / 50) * 20000), i % 7 === 0 ? 30000 : 0]);
    const whole = new PeakReader();
    whole.push(audio);

    const split = new PeakReader();
    for (let at = 0; at < audio.length; at += 4097) split.push(audio.subarray(at, at + 4097));

    expect(split.finish()).toEqual(whole.finish());
  });

  it("gives fewer peaks than PEAK_COUNT for audio too short to fill them", () => {
    const reader = new PeakReader();
    reader.push(seconds(0.5, () => [32767, 32767]));
    const result = reader.finish()!;
    expect(result.peaks.length).toBeGreaterThan(0);
    expect(result.peaks.length).toBeLessThan(PEAK_COUNT);
    expect(result.peaks.every((p) => p === 100)).toBe(true);
    expect(result.duration).toBe(0.5);
  });

  it("never reports above 100, even for the most negative sample", () => {
    const reader = new PeakReader();
    reader.push(seconds(2, () => [-32768, -32768]));
    expect(Math.max(...reader.finish()!.peaks)).toBe(100);
  });
});
