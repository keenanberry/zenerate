/**
 * The ambient beds baked into the sandbox snapshot's /sounds/ambient
 * directory, which generate-audio.ts loops under the narration. Two kinds, as
 * with scripts/sound-effects.ts:
 *
 * - SYNTHESIZED_BEDS are rendered from a recipe by FFmpeg, at snapshot build
 *   time and by scripts/export-sound-previews.ts --ambient for the previews.
 * - RECORDED_BEDS are CC0 Freesound recordings, processed once. Unlike the
 *   gongs they are not kept in the storage bucket: the processed file is
 *   committed under RECORDED_BED_DIR, and the snapshot build reads it and
 *   verifies its checksum.
 *
 * Every bed is a seamless loop and is quiet by design, at BED_LUFS.
 * src/lib/meditation/ambience.ts names them and sets each one's level in the
 * mix; a test holds the two files in step.
 *
 * The card's previews in public/sounds/ambient/ are the same audio turned
 * down to AMBIENT_PREVIEW_LUFS, written by scripts/export-sound-previews.ts
 * --ambient, so a preview sounds as loud as the bed does in a meditation.
 */

/** Integrated loudness of every bed file. ambience.ts's volume sets the mix level. */
export const BED_LUFS = -28;

/**
 * The level a bed is heard at in a meditation: measured in rendered mixes,
 * each bed sits at -36 to -38 LUFS in the silences under -21 LUFS narration.
 * The previews play at this level, so a preview matches the result.
 */
export const AMBIENT_PREVIEW_LUFS = -37;

/** Gain from a bed file to its preview. The files are all at BED_LUFS, so one number. */
export const PREVIEW_GAIN_DB = AMBIENT_PREVIEW_LUFS - BED_LUFS;

/** Where the processed recordings are committed, relative to the repo root. */
export const RECORDED_BED_DIR = "scripts/ambient";

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
  /**
   * Render it to FLAC in the snapshot instead of MP3. MP3's encoder leaves a
   * small error at a file's first and last samples, which is a tick at every
   * loop point on a smooth pad, though noise and a drone starting from zero
   * both hide it.
   */
  lossless?: boolean;
}

export interface RecordedBed {
  id: string;
  /** Length of the processed loop, seconds. */
  seconds: number;
  /** SHA-256 of RECORDED_BED_DIR/<id>.mp3, checked on every snapshot build. */
  sha256: string;
  source: string;
  /** The file actually downloaded: Freesound's HQ preview, since originals need a login. */
  downloaded: string;
  author: string;
  license: "CC0-1.0";
  /** How the original was turned into this file, so it can be redone. */
  processing: string;
}

export const SYNTHESIZED_BEDS: SynthesizedBed[] = [
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
  {
    // A dark, open D chord (no third) of soft triangle-ish partials, each a
    // pair a fraction of a hertz apart, so it beats slowly and differently in
    // each ear; a faint high shimmer that surfaces now and then; and one
    // distant swell a cycle. All of it through long echo tails, mostly wet.
    //
    // Every frequency and envelope completes a whole number of cycles in
    // 90 s, and the echoes are linear, so after the longest one the output
    // is exactly periodic. The recipe renders a little over two periods and
    // keeps the second, which loops as rendered with nothing to crossfade.
    //
    // The tails are feedback-free aecho taps rather than an afir convolution
    // reverb: afir normalizes its impulse by a rule that changed in FFmpeg
    // 6.1, so the snapshot's FFmpeg (7.x) rendered it 20 dB quieter than a
    // local 6.0 did. aecho renders the same on both.
    id: "space",
    seconds: 90,
    periodic: true,
    lossless: true,
    graph: (() => {
      const P = 90;
      // A frequency near `hz` with a whole number of cycles in P, written as
      // that exact fraction: a rounded decimal drifts out of phase by the seam.
      const cycles = (hz: number) => Math.round(hz * P);
      const f = (hz: number) => `${cycles(hz)}/${P}`;
      // A slow 0-1 envelope: `cycles` per period, sharpened by `power`, so a
      // high power gives brief, occasional peaks.
      const swell = (cycles: number, phase: number, power = 1) =>
        `pow(0.5-0.5*cos(2*PI*${cycles}*t/${P}+${phase}),${power})`;
      // Fundamental plus a little third harmonic: rounder than a sine.
      const tone = (hz: string) => `(sin(2*PI*${hz}*t)+0.1*sin(2*PI*3*${hz}*t))`;
      // Two oscillators `beat` cycles per period apart.
      const pair = (hz: number, beat: number) =>
        `(${tone(f(hz))}+${tone(`${cycles(hz) + beat}/${P}`)})`;

      const voice = (side: 0 | 1) => {
        const b = side + 1;
        const ph = side * 1.7;
        return [
          // D2, A2, E3, A3, D4, E4: the pad, an open chord with no third,
          // each voice breathing on its own cycle.
          `0.05*${pair(73.42, b)}*(0.6+0.4*${swell(1, ph)})`,
          `0.04*${pair(110, 3 - b)}*(0.5+0.5*${swell(2, 1 + ph)})`,
          `0.09*${pair(164.81, b + 1)}*(0.4+0.6*${swell(3, 2 - ph)})`,
          `0.08*${pair(220, 4 - b)}*(0.3+0.7*${swell(5, 3 + ph)})`,
          `0.07*${pair(293.66, b)}*${swell(2, 4 - ph, 2)}`,
          `0.05*${pair(329.63, 3 - b)}*${swell(3, 0.8 + ph, 2)}`,
          // The distant swell: D3 and A3 rising once a period, a few
          // seconds apart in each ear.
          `0.08*(sin(2*PI*${f(146.83)}*t)+0.6*sin(2*PI*${f(220)}*t))*${swell(1, 2.5 + side * 0.4, 4)}`,
          // The shimmer: F#5, A5, B5, E6, B6, each surfacing for a while.
          `0.10*sin(2*PI*${f(739.99)}*t)*${swell(2, 0.5 + ph, 6)}`,
          `0.08*sin(2*PI*${f(880)}*t)*${swell(3, 2.2 + ph, 6)}`,
          `0.07*sin(2*PI*${f(987.77)}*t)*${swell(1, 4.1 - ph, 6)}`,
          `0.05*sin(2*PI*${f(1318.51)}*t)*${swell(4, 5.3 + ph, 8)}`,
          `0.025*sin(2*PI*${f(1975.53)}*t)*${swell(3, 1.4 - ph, 10)}`,
        ].join("+");
      };

      // Echo taps at `delays` ms, each quieter by the same exponential decay.
      const echoes = (delays: number[]) =>
        `aecho=0:1:${delays.join("|")}:${delays.map((d) => (0.6 * Math.exp(-d / 1300)).toFixed(4)).join("|")}`;

      return [
        `aevalsrc='${voice(0)}|${voice(1)}':s=44100:d=${2 * P + 10},asplit=2[dry][wet]`,
        // Sixteen taps an ear out to about 8 s, at different delays in each
        // so the tail is wide, decaying about 60 dB over 9 s, then darkened
        // so it is a wash rather than a ring.
        "[wet]channelsplit=channel_layout=stereo[wl][wr]",
        `[wl]${echoes([89, 197, 331, 487, 673, 911, 1193, 1531, 1949, 2441, 3019, 3701, 4493, 5419, 6491, 7727])}[el]`,
        `[wr]${echoes([113, 227, 367, 541, 743, 997, 1301, 1667, 2111, 2633, 3251, 3967, 4813, 5791, 6917, 8221])}[er]`,
        "[el][er]amerge=inputs=2,lowpass=f=4000[verb]",
        "[dry]volume=0.3[dry2]",
        `[dry2][verb]amix=inputs=2:normalize=0,bass=g=10:f=120,treble=g=-6.5:f=450,highpass=f=35,lowpass=f=7000,atrim=${P}:${2 * P},asetpts=PTS-STARTPTS[src]`,
      ].join(";");
    })(),
    gainDb: -12.6,
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
  {
    // Picked by the operator from four CC0 candidates (task 44).
    id: "chant",
    seconds: 30,
    sha256: "27f2be605262ffc98495bc1c1d583e30c56eef177d0df6579b60f5e2252e6a5d",
    source: "https://freesound.org/people/szegvari/sounds/545055/",
    downloaded: "https://cdn.freesound.org/previews/545/545055_2282212-hq.mp3",
    author: "szegvari",
    license: "CC0-1.0",
    processing:
      "HQ preview (44.1 kHz MP3), 16-50 s (steadiest loudness), high-pass 80 Hz, low-pass 4 kHz (sets it back behind the voice), loopFilter to 30 s, -13.60 dB to BED_LUFS, 128k MP3",
  },
];

/** The bed's file name in the snapshot's sounds/ambient/. */
export function snapshotFile(bed: SynthesizedBed | RecordedBed): string {
  return `${bed.id}.${"lossless" in bed && bed.lossless ? "flac" : "mp3"}`;
}

/** The bed's preview file name in public/sounds/ambient/ (and a recording's in RECORDED_BED_DIR). */
export function previewFile(id: string): string {
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

const LOSSLESS_ENCODE = ["-ar", "44100", "-ac", "2", "-c:a", "flac"];

/**
 * FFmpeg arguments that render `bed` to `outPath`, FLAC or MP3 by its
 * extension, `extraGainDb` above BED_LUFS (PREVIEW_GAIN_DB for a preview).
 */
export function bedArgs(bed: SynthesizedBed, outPath: string, extraGainDb = 0): string[] {
  return [
    "-y",
    "-filter_complex",
    [
      bed.graph,
      bed.periodic ? "[src]anull[loop]" : loopFilter(bed.seconds, "src", "loop"),
      `[loop]volume=${(bed.gainDb + extraGainDb).toFixed(2)}dB[out]`,
    ].join(";"),
    "-map", "[out]",
    ...(outPath.endsWith(".flac") ? LOSSLESS_ENCODE : BED_ENCODE),
    outPath,
  ];
}

/** FFmpeg arguments that turn a recorded bed's file into its preview. */
export function recordingPreviewArgs(inPath: string, outPath: string): string[] {
  return ["-y", "-i", inPath, "-af", `volume=${PREVIEW_GAIN_DB}dB`, ...BED_ENCODE, outPath];
}
