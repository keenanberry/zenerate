/**
 * The ambient beds baked into the sandbox snapshot's /sounds/ambient
 * directory, which generate-audio.ts loops under the narration. Two kinds, as
 * with scripts/sound-effects.ts:
 *
 * - SYNTHESIZED_BEDS are rendered from a recipe by FFmpeg, at snapshot build
 *   time and by scripts/export-sound-previews.ts --ambient for the previews.
 * - RECORDED_BEDS are CC0 Freesound recordings, processed once. Unlike the
 *   gongs they are not kept in the storage bucket: the processed file is
 *   committed under public/sounds/ambient/ as the card's preview, and the
 *   snapshot build reads that same file and verifies its checksum, so the
 *   preview is exactly what gets mixed.
 *
 * Every bed is a seamless loop (loopFilter) and is quiet by design, at
 * BED_LUFS. src/lib/meditation/ambience.ts names them and sets each one's
 * level in the mix; a test holds the two files in step.
 */

/** Integrated loudness of every bed file. ambience.ts's volume sets the mix level. */
export const BED_LUFS = -28;

/**
 * Seconds of the source's tail crossfaded over its head so the loop has no
 * seam. A recipe or recording supplies `seconds + LOOP_CROSSFADE` of audio.
 */
export const LOOP_CROSSFADE = 4;

export interface SynthesizedBed {
  id: string;
  /** Length of the rendered loop, seconds. */
  seconds: number;
  /**
   * A lavfi filtergraph producing stereo audio at 44.1 kHz, labelled [src]:
   * `seconds + LOOP_CROSSFADE` long, or exactly `seconds` when periodic.
   */
  graph: string;
  /**
   * The recipe repeats exactly every `seconds`, so it loops as rendered. A
   * crossfade would only add a 3 dB swell, its head and tail being identical.
   */
  periodic?: boolean;
  /** Fixed gain bringing the recipe to BED_LUFS, measured once (loudnorm would ride the level and break the seam). */
  gainDb: number;
}

export interface RecordedBed {
  id: string;
  /** Length of the processed loop, seconds. */
  seconds: number;
  /** SHA-256 of public/sounds/ambient/<id>.mp3, checked on every snapshot build. */
  sha256: string;
  source: string;
  /** The file actually downloaded: Freesound's HQ preview, since originals need a login. */
  downloaded: string;
  author: string;
  license: "CC0-1.0";
  /** How the original was turned into this file, so it can be redone. */
  processing: string;
}

const RENDER_SECONDS = (seconds: number) => seconds + LOOP_CROSSFADE;

export const SYNTHESIZED_BEDS: SynthesizedBed[] = [
  {
    // Two independent seeded channels, so it is wide rather than centred.
    // The high-pass takes out sub-bass rumble that only eats headroom; the
    // low-pass softens it from a hiss to a hush.
    id: "brown-noise",
    seconds: 30,
    graph: [
      `anoisesrc=color=brown:seed=4011:amplitude=0.5:sample_rate=44100:duration=${RENDER_SECONDS(30)}[l]`,
      `anoisesrc=color=brown:seed=4012:amplitude=0.5:sample_rate=44100:duration=${RENDER_SECONDS(30)}[r]`,
      "[l][r]amerge=inputs=2,highpass=f=40,lowpass=f=2500[src]",
    ].join(";"),
    gainDb: -8.2,
  },
  {
    // A on 110 Hz with its fifth, octave and twelfth, each swelling on its
    // own slow cycle, and the right channel detuned by 0.1 Hz, a slow 10 s
    // beat, so the drone breathes. Every frequency and swell completes a
    // whole number of cycles in 30 s, so it is periodic and loops as rendered.
    id: "drone",
    seconds: 30,
    periodic: true,
    graph: (() => {
      const d = 30;
      const voice = (detune: number) =>
        [
          `0.40*sin(2*PI*${110 + detune}*t)*(0.75+0.25*cos(2*PI*t/${d}))`,
          `0.22*sin(2*PI*${165 + detune}*t)*(0.6+0.4*sin(2*PI*t/${d / 2}))`,
          `0.16*sin(2*PI*${220 + detune}*t)*(0.6+0.4*cos(2*PI*t/${d / 3}))`,
          `0.05*sin(2*PI*${330 + detune}*t)*(0.5+0.5*sin(2*PI*t/${d / 4}))`,
        ].join("+");
      return `aevalsrc=${voice(0)}|${voice(0.1)}:s=44100:d=${d}[src]`;
    })(),
    gainDb: -17.2,
  },
];

export const RECORDED_BEDS: RecordedBed[] = [
  {
    id: "rain",
    seconds: 30,
    sha256: "068d23af06e48381547d5fde882932a2b3113b23277c698a14bab101f3fd9f64",
    source: "https://freesound.org/people/speakwithanimals/sounds/525046/",
    downloaded: "https://cdn.freesound.org/previews/525/525046_10637780-hq.mp3",
    author: "speakwithanimals",
    license: "CC0-1.0",
    processing:
      "HQ preview (48 kHz MP3), 47.5-81.5 s, resampled to 44.1 kHz, high-pass 40 Hz, loopFilter to 30 s, -2.30 dB to BED_LUFS, 128k MP3",
  },
  {
    id: "ocean",
    seconds: 40,
    sha256: "59b95358a10e3dd930077d1dbf78e14fec70bbca94cfeeef290cda79615a1133",
    source: "https://freesound.org/people/L.Finck/sounds/636552/",
    downloaded: "https://cdn.freesound.org/previews/636/636552_14042309-hq.mp3",
    author: "L.Finck",
    license: "CC0-1.0",
    processing:
      "HQ preview (48 kHz MP3), 1-45 s, resampled to 44.1 kHz, high-pass 40 Hz, loopFilter to 40 s, -1.30 dB to BED_LUFS, 128k MP3",
  },
  {
    id: "forest",
    seconds: 40,
    sha256: "8a4ac613707c264b645033bb9b1aedee0d6fb846c611fe5cdd077f8fdd57c6ec",
    source: "https://freesound.org/people/pborel/sounds/474342/",
    downloaded: "https://cdn.freesound.org/previews/474/474342_9461190-hq.mp3",
    author: "pborel",
    license: "CC0-1.0",
    processing:
      "HQ preview (48 kHz MP3), 26.5-70.5 s, resampled to 44.1 kHz, high-pass 80 Hz, +17 dB, acompressor threshold=0.03 ratio=3 attack=5 release=250 (tames the nearest bird calls), low-pass 10 kHz, loopFilter to 40 s, +4.50 dB to BED_LUFS, 128k MP3",
  },
];

export function bedFile(id: string): string {
  return `${id}.mp3`;
}

/**
 * Filtergraph turning [in], `seconds + LOOP_CROSSFADE` long, into [loop],
 * `seconds` long, which joins end to start with no seam: its first
 * LOOP_CROSSFADE seconds are the source's head fading in over its tail fading
 * out, so the loop opens where the source carried on past the loop's end.
 * Equal-power fades, since head and tail are uncorrelated.
 */
export function loopFilter(seconds: number, input = "in", output = "loop"): string {
  const x = LOOP_CROSSFADE;
  return [
    `[${input}]asplit=3[head][body][tail]`,
    `[head]atrim=0:${x},asetpts=PTS-STARTPTS,afade=t=in:d=${x}:curve=qsin[headf]`,
    `[tail]atrim=${seconds}:${seconds + x},asetpts=PTS-STARTPTS,afade=t=out:d=${x}:curve=qsin[tailf]`,
    `[headf][tailf]amix=inputs=2:normalize=0[seam]`,
    `[body]atrim=${x}:${seconds},asetpts=PTS-STARTPTS[rest]`,
    `[seam][rest]concat=n=2:v=0:a=1[${output}]`,
  ].join(";");
}

/** Encoder settings shared by every bed: 44.1 kHz stereo, 128k MP3. */
export const BED_ENCODE = ["-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k"];

/** FFmpeg arguments that render `bed` to `outPath`. */
export function bedArgs(bed: SynthesizedBed, outPath: string): string[] {
  return [
    "-y",
    "-filter_complex",
    [
      bed.graph,
      bed.periodic ? "[src]anull[loop]" : loopFilter(bed.seconds, "src", "loop"),
      `[loop]volume=${bed.gainDb}dB[out]`,
    ].join(";"),
    "-map", "[out]",
    ...BED_ENCODE,
    outPath,
  ];
}
