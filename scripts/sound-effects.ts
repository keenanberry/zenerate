/**
 * The sound effects baked into the sandbox snapshot's /sounds directory, for
 * `*[SOUND: file]*` markers. Two kinds:
 *
 * - SYNTHESIZED_SOUNDS are rendered from a recipe by FFmpeg at snapshot build
 *   time: no licensing, no stored files.
 * - RECORDED_SOUNDS are CC0 recordings, processed once and kept in the private
 *   `sound-effects` bucket of the production Supabase project. The build
 *   downloads them and verifies each checksum.
 *
 * Synthesis could not make a convincing gong, so the gongs are recordings.
 *
 * Every file here must appear in src/lib/meditation/sounds.ts with the same
 * duration; a test enforces it.
 */

interface Partial {
  /** Frequency as a multiple of the effect's fundamental. */
  ratio: number;
  amp: number;
  /** Exponential decay time constant, seconds. */
  decay: number;
}

export interface SynthesizedSound {
  file: string;
  /** Length of the rendered file, seconds. */
  duration: number;
  fundamental: number;
  partials: Partial[];
  /** Rise time of the strike, seconds. Longer reads as a softer mallet. */
  attack: number;
}

export interface RecordedSound {
  file: string;
  /** Length of the processed file, seconds. */
  duration: number;
  /** Object path in the `sound-effects` bucket. */
  storagePath: string;
  /** SHA-256 of the processed file, checked on every snapshot build. */
  sha256: string;
  source: string;
  author: string;
  license: "CC0-1.0";
  /** How the original was turned into this file, so it can be redone. */
  processing: string;
}

// Inharmonic mode ratios for each instrument family.
const BOWL = [1, 2.71, 5.15, 8.17];
const CHIME = [1, 2.76, 5.4, 8.93];

export const SYNTHESIZED_SOUNDS: SynthesizedSound[] = [
  {
    file: "bell-tibetan.mp3",
    duration: 7,
    fundamental: 660,
    attack: 0.004,
    partials: BOWL.map((ratio, i) => ({
      ratio,
      amp: [0.5, 0.3, 0.15, 0.08][i],
      decay: [5, 2.5, 1.2, 0.6][i],
    })),
  },
  {
    file: "bell-crystal.mp3",
    duration: 5,
    fundamental: 1568,
    attack: 0.002,
    partials: [1, 2.32, 4.25, 6.63].map((ratio, i) => ({
      ratio,
      amp: [0.5, 0.18, 0.06, 0.02][i],
      decay: [3, 1.2, 0.6, 0.3][i],
    })),
  },
  {
    file: "chime-soft.mp3",
    duration: 4,
    fundamental: 1047,
    attack: 0.008,
    partials: CHIME.map((ratio, i) => ({
      ratio,
      amp: [0.5, 0.14, 0.04, 0.01][i],
      decay: [2.5, 1, 0.4, 0.2][i],
    })),
  },
  {
    file: "bowls-singing.mp3",
    duration: 10,
    fundamental: 220,
    attack: 0.015,
    partials: BOWL.map((ratio, i) => ({
      ratio,
      amp: [0.55, 0.3, 0.12, 0.05][i],
      decay: [9, 5, 2.5, 1.2][i],
    })),
  },
];

export const RECORDED_SOUNDS: RecordedSound[] = [
  {
    file: "gong-gentle.mp3",
    duration: 4,
    storagePath: "gong-gentle.mp3",
    sha256: "1fa51aba22e9c4989d90797dcb5b8d98130179340a752f233683204a9b28560a",
    source: "https://freesound.org/people/cabled_mess/sounds/369428/",
    author: "cabled_mess",
    license: "CC0-1.0",
    processing:
      "silenceremove start -50dB, first 4s, 1s fade-out, loudnorm I=-24 then -4.4 dB, 44.1 kHz stereo 128k MP3",
  },
  {
    file: "gong-deep.mp3",
    duration: 12,
    storagePath: "gong-deep.mp3",
    sha256: "14ca8612c9e5e2925da489ff0a87b4dd335336689b215f5b766c1a42504a6fe8",
    source: "https://freesound.org/people/psuess/sounds/194432/",
    author: "psuess",
    license: "CC0-1.0",
    processing:
      "silenceremove start -50dB, first 12s, 4s fade-out, loudnorm I=-24 then +1.5 dB, 44.1 kHz stereo 128k MP3",
  },
];

/**
 * Right-channel detune. Each partial sounds at a slightly different pitch per
 * ear; the difference beats slowly, which is the shimmer of a real bowl.
 */
const STEREO_DETUNE = 1.0015;

/**
 * Level of the synthesized sounds, set by ear against the recorded gongs and
 * then checked in a mock mix against narration at -20 LUFS (see
 * src/lib/audio/loudness.ts). Normalizing to a LUFS target alone was no use:
 * the meter rates these 0.6-1.6 kHz pure tones far quieter than they sound
 * next to the bass-heavy gongs, so "equal LUFS" was ~15 dB too loud by ear.
 * loudnorm gives each recipe a consistent starting level; the gain sets it.
 */
const SYNTH_LOUDNORM_LUFS = -29;
const SYNTH_GAIN_DB = -14;

function channelExpr(sound: SynthesizedSound, detune: number): string {
  const tones = sound.partials.map(
    (p) =>
      `${p.amp}*sin(2*PI*${(sound.fundamental * p.ratio * detune).toFixed(3)}*t)*exp(-t/${p.decay})`,
  );
  return `(1-exp(-t/${sound.attack}))*(${tones.join("+")})`;
}

/** FFmpeg arguments that render `sound` to `outPath`. */
export function ffmpegArgs(sound: SynthesizedSound, outPath: string): string[] {
  const left = channelExpr(sound, 1);
  const right = channelExpr(sound, STEREO_DETUNE);
  const fade = Math.min(1.5, sound.duration / 3);
  return [
    "-y",
    "-f", "lavfi",
    "-i", `aevalsrc=${left}|${right}:s=44100:d=${sound.duration}`,
    "-af", [
      `afade=t=out:st=${sound.duration - fade}:d=${fade}`,
      `loudnorm=I=${SYNTH_LOUDNORM_LUFS}:TP=-3:LRA=11`,
      `volume=${SYNTH_GAIN_DB}dB`,
    ].join(","),
    "-ar", "44100",
    "-ac", "2",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    outPath,
  ];
}
