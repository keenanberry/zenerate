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
import { createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { narrationGainDb, parseIntegratedLoudness } from "./loudness";

// ---------------------------------------------------------------------------
// Types (self-contained — the only project import is ./loudness, which has no
// dependencies and is bundled in by esbuild)
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

async function generateSpeech(
  client: ElevenLabsClient,
  text: string,
  voiceId: string,
  outputPath: string,
  voiceSettings?: Config["voiceSettings"],
): Promise<number> {
  const { data, rawResponse } = await client.textToSpeech
    .convert(voiceId, {
      text,
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

  return characterCount;
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
      .audioBitrate("192k")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ---------------------------------------------------------------------------
// Background music mixing with volume ducking
// ---------------------------------------------------------------------------

function mixBackgroundMusic(
  voicePath: string,
  musicPath: string,
  outputPath: string,
  musicVolume: number = 0.15,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voicePath)
      .input(musicPath)
      .complexFilter([
        "[1:a]aloop=loop=-1:size=2e+09[music]",
        `[music]volume=${musicVolume}[musicvol]`,
        `[musicvol][0:a]sidechaincompress=threshold=-30dB:ratio=4:attack=500:release=1500[ducked]`,
        "[0:a][ducked]amix=inputs=2:duration=first:dropout_transition=2[out]",
      ])
      .outputOptions("-map", "[out]")
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
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

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const outPath = join(TEMP_DIR, `segment_${String(i).padStart(4, "0")}.mp3`);

    switch (segment.type) {
      case "speech": {
        console.log(`[${i + 1}/${segments.length}] Generating speech (${segment.content!.length} chars)...`);
        const chars = await generateSpeech(client, segment.content!, voiceId, outPath, voiceSettings);
        ttsCharacters += chars;
        ttsRequests++;
        speechIndices.add(i);
        console.log(`  → ${chars} characters billed`);
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

  // Process all segments sequentially to stay within API rate limits
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

  // Mix background music if provided
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

  const processingTimeMs = Date.now() - startTime;
  const elapsed = (processingTimeMs / 1000).toFixed(1);

  const result = {
    ttsCharacters,
    ttsRequests,
    processingTimeMs,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2));

  console.log(`Done! Output written to ${OUTPUT_PATH} in ${elapsed}s`);
  console.log(`TTS cost: ${ttsCharacters} characters across ${ttsRequests} requests`);
}

main().catch((err) => {
  console.error("Audio generation failed:", err);
  process.exit(1);
});
