/**
 * The ambient bed's mix under the narration. Bundled into the sandbox
 * snapshot via generate-audio.ts -- an edit here needs a snapshot rebuild.
 *
 * The bed (src/lib/meditation/ambience.ts) loops for the whole meditation,
 * is ducked by the narration through a side-chain compressor, and fades in
 * at the start and out at the end, so it never starts or stops on a cut.
 */

export const BED_FADE_IN_SECONDS = 3;
const BED_FADE_OUT_SECONDS = 8;

/** The same ceiling the narration's own limiter holds (-1 dBFS). */
const LIMIT = 0.891;

/**
 * Length in seconds from ffmpeg's `Duration: HH:MM:SS.xx` input line, or null
 * when it is missing or unknown ("N/A").
 */
export function parseMediaSeconds(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * Filtergraph mixing input 1 (the bed) under input 0 (the narration) into
 * [out]. `voiceSeconds` places the fade-out; without it the bed stops with
 * the narration, as it did before the fade existed.
 *
 * amix runs with normalize=0: its default divides every input by the input
 * count, which would pull the narration 6 dB under its -20 LUFS target.
 */
export function bedMixFilter(musicVolume: number, voiceSeconds: number | null): string[] {
  const fades = [`afade=t=in:d=${BED_FADE_IN_SECONDS}`];
  if (voiceSeconds !== null && voiceSeconds > BED_FADE_IN_SECONDS * 2) {
    const fadeOut = Math.min(BED_FADE_OUT_SECONDS, voiceSeconds / 4);
    fades.push(`afade=t=out:st=${(voiceSeconds - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`);
  }

  return [
    "[0:a]asplit=2[voice][key]",
    `[1:a]aloop=loop=-1:size=2e+09,volume=${musicVolume},${fades.join(",")}[music]`,
    "[music][key]sidechaincompress=threshold=-30dB:ratio=4:attack=500:release=1500[ducked]",
    `[voice][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=${LIMIT}:level=false[out]`,
  ];
}
