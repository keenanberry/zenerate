import type { Waveform } from "@/lib/meditation/types";

/**
 * Well over PEAK_COUNT (peaks.ts) on purpose: a later change to the count
 * must not make earlier renders' peaks unreadable.
 */
const MAX_PEAKS = 50_000;

/**
 * The waveform in a sandbox result or a generation_meta, or null when it has
 * none or it is malformed. wavesurfer throws on an empty array or a zero
 * duration, and a NaN would draw nothing, so anything doubtful is left out
 * and the player decodes the file itself, as it did before peaks existed.
 */
export function waveformOf(source: unknown): Waveform | null {
  if (!source || typeof source !== "object") return null;
  const { peaks, duration } = source as { peaks?: unknown; duration?: unknown };
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null;
  if (!Array.isArray(peaks) || peaks.length === 0 || peaks.length > MAX_PEAKS) return null;
  // Percent of full scale (peaks.ts).
  if (!peaks.every((p) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 100)) {
    return null;
  }
  return { peaks: peaks as number[], duration };
}
