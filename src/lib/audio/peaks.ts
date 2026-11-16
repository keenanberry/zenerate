/**
 * The waveform the player draws, read from the final mix (ship task 60).
 * Bundled into the sandbox snapshot via generate-audio.ts -- an edit here
 * needs a snapshot rebuild. scripts/backfill-peaks.ts runs the same reader
 * over files rendered before it existed.
 *
 * Handed precomputed peaks, wavesurfer draws at once and the audio streams
 * from the <audio> element on play. Without them it downloads the whole file
 * to decode it, on page load, which made every meditation page view cost a
 * full file of storage egress.
 *
 * The reader follows what wavesurfer drew from the decoded file, so the
 * waveform looks the same: wavesurfer decodes at 8 kHz by default, and each
 * bar is the loudest sample (absolute value) it covers. Here each peak is the
 * loudest sample of either channel. Checked against Chrome's own decode of a
 * production render: 99% of the 8,000 peaks within 2 points of 100.
 */

/** wavesurfer's default decoding rate. */
export const PEAKS_SAMPLE_RATE = 8000;

/**
 * wavesurfer gives a bar every peak whose position rounds to it, so a peak's
 * whole window lands in one bar. With 1,000 peaks a loud onset near a bar's
 * edge moved to the neighbouring bar: on a 10-minute file, 5 of the card's
 * 127 bars came out more than 4px off the decoded drawing, one by 47px. From
 * about 5,000 on, every bar is within 3px; 8,000 leaves room. As integers
 * that is about 16 KB of JSON per render.
 */
export const PEAK_COUNT = 8000;

const CHANNELS = 2;

/** ffmpeg output options for what PeakReader reads: 8 kHz stereo s16le. */
export const PEAKS_DECODE_ARGS = ["-ac", String(CHANNELS), "-ar", String(PEAKS_SAMPLE_RATE), "-f", "s16le"];

/**
 * 5 ms blocks, under a fifth of a peak's window even for a 3-minute file.
 * Their maxima are all the reader keeps, so a 30-minute file holds 360,000
 * numbers rather than 29 million samples.
 */
const BLOCK_SAMPLES = (PEAKS_SAMPLE_RATE / 200) * CHANNELS;

const FULL_SCALE = 32768;

export interface Peaks {
  /**
   * Percent of full scale, integers 0..100, at most PEAK_COUNT of them. The
   * precision of two decimals at under half the JSON; the player divides by
   * 100 for wavesurfer, which takes 0..1.
   */
  peaks: number[];
  /** Seconds, to the millisecond. */
  duration: number;
}

/** Feed it ffmpeg's PEAKS_DECODE_ARGS output in chunks of any size, then finish(). */
export class PeakReader {
  private blocks: number[] = [];
  private blockMax = 0;
  private inBlock = 0;
  private samples = 0;
  /** The odd byte of a sample split across two chunks. */
  private carry: Buffer | null = null;

  push(chunk: Uint8Array): void {
    let buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    if (this.carry) {
      buf = Buffer.concat([this.carry, buf]);
      this.carry = null;
    }
    const whole = buf.length - (buf.length % 2);
    if (whole < buf.length) this.carry = Buffer.from(buf.subarray(whole));

    for (let i = 0; i < whole; i += 2) {
      const magnitude = Math.abs(buf.readInt16LE(i));
      if (magnitude > this.blockMax) this.blockMax = magnitude;
      if (++this.inBlock === BLOCK_SAMPLES) this.closeBlock();
    }
    this.samples += whole / 2;
  }

  /** The peaks and length, or null when no audio was read. */
  finish(): Peaks | null {
    if (this.inBlock > 0) this.closeBlock();
    const frames = Math.floor(this.samples / CHANNELS);
    const blocks = this.blocks.length;
    if (frames === 0 || blocks === 0) return null;

    const count = Math.min(PEAK_COUNT, blocks);
    const peaks: number[] = [];
    for (let i = 0; i < count; i++) {
      const start = Math.floor((i * blocks) / count);
      const end = Math.floor(((i + 1) * blocks) / count);
      let max = 0;
      for (let b = start; b < end; b++) if (this.blocks[b] > max) max = this.blocks[b];
      peaks.push(Math.min(100, Math.round((max / FULL_SCALE) * 100)));
    }
    return { peaks, duration: Math.round((frames / PEAKS_SAMPLE_RATE) * 1000) / 1000 };
  }

  private closeBlock() {
    this.blocks.push(this.blockMax);
    this.blockMax = 0;
    this.inBlock = 0;
  }
}
