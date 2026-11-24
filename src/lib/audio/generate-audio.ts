/**
 * Standalone audio generation script that runs inside a Vercel Sandbox.
 *
 * Reads config.json from the sandbox filesystem, processes each meditation
 * segment (TTS, silence, sound effects), normalizes the narration's loudness,
 * concatenates them, optionally mixes background music, and writes the final
 * MP3 to output.mp3.
 *
 * This file is compiled to JS and baked into the sandbox snapshot — it is NOT
 * uploaded per-run. Only config.json is written at runtime.
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import ffmpeg from "fluent-ffmpeg";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { isNearSilent, parseMaxVolume } from "./clip-check";
import { narrationGainDb, parseIntegratedLoudness } from "./loudness";
import { bedMixFilter, parseMediaSeconds } from "./mix";
import { PEAKS_DECODE_ARGS, PeakReader, type Peaks } from "./peaks";
import { RequestChain, stitchedSpeech, type SpeechResponse } from "./stitching";

// ---------------------------------------------------------------------------
// Types (self-contained — the only project imports are ./clip-check,
// ./loudness, ./mix, ./peaks and ./stitching, which have no dependencies and
// are bundled in by esbuild)
// ---------------------------------------------------------------------------

interface Segment {
  type: "speech" | "pause" | "silence" | "sound";
  content?: string;
  duration?: number;
  file?: string;
}

interface Config {
  segments: Segment[];
  voiceId: string;
  elevenLabsApiKey: string;
  backgroundMusic?: string | null;
  musicVolume?: number;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMP_DIR = "./temp";
const SOUNDS_DIR = "./sounds";
const OUTPUT_PATH = "./output.mp3";
const RESULT_PATH = "./result.json";

/**
 * The final mix's bitrate, chosen by ear on 2026-11-16 (task 60) from 192, 128
 * and 96 kbps samples of an ocean-bed meditation. The narration arrives from
 * ElevenLabs at 128 kbps, so 192 only spent its extra bits on the bed; 128
 * cuts every file, and every full listen's egress, by a third.
 */
const OUTPUT_BITRATE = "128k";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// TTS via ElevenLabs
// ---------------------------------------------------------------------------

/**
 * One line of narration. `previousRequestIds` stitches it to the lines before
 * it (see ./stitching); empty for the first line. Returns the characters billed
 * and the response's request id, for the next line to stitch to.
 */
async function generateSpeech(
  client: ElevenLabsClient,
  text: string,
  voiceId: string,
  outputPath: string,
  previousRequestIds: string[],
  voiceSettings?: Config["voiceSettings"],
): Promise<SpeechResponse<number>> {
  const { data, rawResponse } = await client.textToSpeech
    .convert(voiceId, {
      text,
      ...(previousRequestIds.length > 0 ? { previousRequestIds } : {}),
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      voiceSettings: voiceSettings
        ? {
            stability: voiceSettings.stability ?? 0.5,
            similarityBoost: voiceSettings.similarityBoost ?? 0.75,
            style: voiceSettings.style ?? 0.0,
            speed: voiceSettings.speed ?? 0.85,
          }
        : {
            stability: 0.5,
            similarityBoost: 0.75,
            style: 0.0,
            speed: 0.85,
          },
    })
    .withRawResponse();

  const headerChars = rawResponse.headers.get("x-character-count");
  const characterCount = headerChars ? parseInt(headerChars, 10) : text.length;

  const readable = Readable.fromWeb(data as import("node:stream/web").ReadableStream);
  const writable = createWriteStream(outputPath);
  await pipeline(readable, writable);

  return { result: characterCount, requestId: rawResponse.headers.get("request-id") };
}

// ---------------------------------------------------------------------------
// Silence generation via FFmpeg
// ---------------------------------------------------------------------------

function generateSilence(
  durationSeconds: number,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("/dev/zero")
      .inputFormat("s16le")
      .inputOptions(["-ar", "44100", "-ac", "2"])
      .duration(durationSeconds)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ---------------------------------------------------------------------------
// Audio concatenation via FFmpeg
// ---------------------------------------------------------------------------

/**
 * Applied to every speech segment. The gain brings narration to the target
 * level; the limiter catches peaks it pushes past -1 dBFS -- a quiet voice can
 * need +14 dB, and its peaks land close to clipping.
 */
function narrationFilter(gainDb: number): string {
  return `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.891:level=false`;
}

/** A clip's loudest sample in dBFS; null when it cannot be measured. */
function peakDb(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg()
      .input(path)
      .audioFilters("volumedetect")
      .format("null")
      .output("-")
      .on("end", (_stdout: string | null, stderr: string | null) =>
        resolve(parseMaxVolume(stderr ?? "")),
      )
      .on("error", () => resolve(null))
      .run();
  });
}

/** Integrated loudness of all the narration, measured as one stream. */
function measureNarration(speechFiles: string[]): Promise<number | null> {
  if (speechFiles.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const command = ffmpeg();
    for (const file of speechFiles) {
      command.input(file);
    }
    const inputs = speechFiles.map((_, i) => `[${i}:a]`).join("");

    command
      .complexFilter(
        `${inputs}concat=n=${speechFiles.length}:v=0:a=1,ebur128=framelog=quiet[out]`,
      )
      .outputOptions("-map", "[out]")
      .format("null")
      .output("-")
      .on("end", (_stdout: string | null, stderr: string | null) =>
        resolve(parseIntegratedLoudness(stderr ?? "")),
      )
      // A failed measurement leaves narration unadjusted rather than failing
      // the whole meditation.
      .on("error", () => resolve(null))
      .run();
  });
}

function concatenateAudio(
  audioFiles: string[],
  outputPath: string,
  speechIndices: Set<number>,
  narrationGain: number,
): Promise<void> {
  const adjustSpeech = narrationGain !== 0 && speechIndices.size > 0;
  if (audioFiles.length === 1 && !adjustSpeech) {
    return copyFile(audioFiles[0], outputPath);
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    for (const file of audioFiles) {
      command.input(file);
    }

    const adjusted = audioFiles
      .map((_, i) =>
        adjustSpeech && speechIndices.has(i)
          ? `[${i}:a]${narrationFilter(narrationGain)}[s${i}];`
          : "",
      )
      .join("");
    const filterInputs = audioFiles
      .map((_, i) => (adjustSpeech && speechIndices.has(i) ? `[s${i}]` : `[${i}:a]`))
      .join("");
    const filterComplex = `${adjusted}${filterInputs}concat=n=${audioFiles.length}:v=0:a=1[out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions("-map", "[out]")
      .audioCodec("libmp3lame")
      .audioBitrate(OUTPUT_BITRATE)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ---------------------------------------------------------------------------
// Background music mixing with volume ducking
// ---------------------------------------------------------------------------

/** Length of an audio file, from ffmpeg's input header; null when unknown. */
function mediaSeconds(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg()
      .input(path)
      .outputOptions("-t", "0")
      .format("null")
      .output("-")
      .on("end", (_stdout: string | null, stderr: string | null) =>
        resolve(parseMediaSeconds(stderr ?? "")),
      )
      // Without a length the bed just stops with the narration, unfaded.
      .on("error", () => resolve(null))
      .run();
  });
}

async function mixBackgroundMusic(
  voicePath: string,
  musicPath: string,
  outputPath: string,
  musicVolume: number = 0.15,
): Promise<void> {
  const voiceSeconds = await mediaSeconds(voicePath);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voicePath)
      .input(musicPath)
      .complexFilter(bedMixFilter(musicVolume, voiceSeconds))
      .outputOptions("-map", "[out]")
      .audioCodec("libmp3lame")
      .audioBitrate(OUTPUT_BITRATE)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ---------------------------------------------------------------------------
// Waveform peaks for the player (task 60)
// ---------------------------------------------------------------------------

/**
 * The final mix's peaks and length, for the player to draw before any audio
 * loads. Null when they cannot be read: the render still succeeds, and the
 * player decodes the file itself as it did before peaks existed.
 */
function readPeaks(path: string): Promise<Peaks | null> {
  const pcmPath = join(TEMP_DIR, "peaks.pcm");
  return new Promise((resolve) => {
    ffmpeg()
      .input(path)
      .noVideo()
      .outputOptions(PEAKS_DECODE_ARGS)
      .output(pcmPath)
      .on("end", async () => {
        try {
          const reader = new PeakReader();
          for await (const chunk of createReadStream(pcmPath)) reader.push(chunk as Buffer);
          resolve(reader.finish());
        } catch {
          resolve(null);
        }
      })
      .on("error", () => resolve(null))
      .run();
  });
}

// ---------------------------------------------------------------------------
// Segment processing
// ---------------------------------------------------------------------------

interface ProcessingResult {
  audioFiles: string[];
  /** Positions in audioFiles that hold narration. */
  speechIndices: Set<number>;
  ttsCharacters: number;
  ttsRequests: number;
}

async function processSegments(
  segments: Segment[],
  client: ElevenLabsClient,
  voiceId: string,
  voiceSettings?: Config["voiceSettings"],
): Promise<ProcessingResult> {
  const audioFiles: string[] = [];
  const speechIndices = new Set<number>();
  let ttsCharacters = 0;
  let ttsRequests = 0;
  // Spans the whole render, across pauses, silences and sounds.
  const chain = new RequestChain();

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const outPath = join(TEMP_DIR, `segment_${String(i).padStart(4, "0")}.mp3`);

    switch (segment.type) {
      case "speech": {
        const stitchedTo = chain.previous().length;
        console.log(
          `[${i + 1}/${segments.length}] Generating speech (${segment.content!.length} chars, ` +
            `stitched to ${stitchedTo} previous request${stitchedTo === 1 ? "" : "s"})...`,
        );
        await stitchedSpeech(
          chain,
          async (previousRequestIds) => {
            const response = await generateSpeech(
              client, segment.content!, voiceId, outPath, previousRequestIds, voiceSettings,
            );
            // Every billed call counts, a re-requested clip included.
            ttsCharacters += response.result;
            ttsRequests++;
            console.log(`  → ${response.result} characters billed`);
            return response;
          },
          {
            // A near-silent clip is requested once more, then fails the
            // render: the workflow retries it, then marks it failed.
            accept: async () => {
              const peak = await peakDb(outPath);
              console.log(`  → peak ${peak === null ? "not measured" : `${peak.toFixed(1)} dB`}`);
              return !isNearSilent(peak);
            },
            label: `[${i + 1}/${segments.length}] "${segment.content!.slice(0, 40)}"`,
          },
        );
        speechIndices.add(i);
        break;
      }
      case "pause":
      case "silence": {
        console.log(`[${i + 1}/${segments.length}] Generating ${segment.type} (${segment.duration}s)...`);
        await generateSilence(segment.duration!, outPath);
        break;
      }
      case "sound": {
        const soundPath = join(SOUNDS_DIR, segment.file!);
        if (await fileExists(soundPath)) {
          console.log(`[${i + 1}/${segments.length}] Copying sound effect: ${segment.file}...`);
          await copyFile(soundPath, outPath);
        } else {
          console.log(`[${i + 1}/${segments.length}] Sound not found: ${segment.file}, using 1s silence...`);
          await generateSilence(1, outPath);
        }
        break;
      }
    }

    audioFiles.push(outPath);
  }

  return { audioFiles, speechIndices, ttsCharacters, ttsRequests };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("Reading config.json...");

  const raw = await readFile("./config.json", "utf-8");
  const config: Config = JSON.parse(raw);

  console.log(`Parsed ${config.segments.length} segments, voice: ${config.voiceId}`);

  await mkdir(TEMP_DIR, { recursive: true });

  const client = new ElevenLabsClient({
    apiKey: config.elevenLabsApiKey,
  });

  // Process all segments sequentially: it stays within API rate limits, and
  // each line is stitched to the request ids of the lines before it.
  const { audioFiles, speechIndices, ttsCharacters, ttsRequests } =
    await processSegments(
      config.segments,
      client,
      config.voiceId,
      config.voiceSettings,
    );

  console.log("Measuring narration loudness...");
  const measured = await measureNarration(
    audioFiles.filter((_, i) => speechIndices.has(i)),
  );
  const narrationGain = narrationGainDb(measured);
  console.log(
    measured === null
      ? "  → could not measure; narration left unadjusted"
      : `  → ${measured} LUFS, applying ${narrationGain.toFixed(1)} dB`,
  );

  // Concatenate all segment audio into a single file
  console.log("Concatenating segments...");
  const voiceOnlyPath = join(TEMP_DIR, "voice-only.mp3");
  await concatenateAudio(audioFiles, voiceOnlyPath, speechIndices, narrationGain);

  // Mix the ambient bed if one was chosen. A snapshot built before the bed
  // existed has no file for it, and the narration goes out alone.
  if (config.backgroundMusic && !(await fileExists(config.backgroundMusic))) {
    console.log(`Ambient bed not found: ${config.backgroundMusic}, skipping it...`);
  }
  if (config.backgroundMusic && (await fileExists(config.backgroundMusic))) {
    console.log("Mixing background music...");
    await mixBackgroundMusic(
      voiceOnlyPath,
      config.backgroundMusic,
      OUTPUT_PATH,
      config.musicVolume ?? 0.15,
    );
  } else {
    await copyFile(voiceOnlyPath, OUTPUT_PATH);
  }

  console.log("Reading waveform peaks...");
  const waveform = await readPeaks(OUTPUT_PATH);
  console.log(
    waveform
      ? `  → ${waveform.peaks.length} peaks over ${waveform.duration.toFixed(1)}s`
      : "  → could not read them; the player will decode the file itself",
  );

  const processingTimeMs = Date.now() - startTime;
  const elapsed = (processingTimeMs / 1000).toFixed(1);

  const result = {
    ttsCharacters,
    ttsRequests,
    processingTimeMs,
    generatedAt: new Date().toISOString(),
    peaks: waveform?.peaks ?? null,
    duration: waveform?.duration ?? null,
  };
  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2));

  console.log(`Done! Output written to ${OUTPUT_PATH} in ${elapsed}s`);
  console.log(`TTS cost: ${ttsCharacters} characters across ${ttsRequests} requests`);
}

main().catch((err) => {
  console.error("Audio generation failed:", err);
  process.exit(1);
});
