import { FatalError } from "workflow";

import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@supabase/supabase-js";
import { parseMeditationText } from "@/lib/meditation/parser";
import { uploadAudio, updateMeditationStatus } from "./storage";
import type { MeditationSegment, GenerationMeta } from "@/lib/meditation/types";

// ---------------------------------------------------------------------------
// Types for serializable data between steps
// ---------------------------------------------------------------------------

interface MeditationData {
  segments: MeditationSegment[];
  voiceId: string;
  backgroundMusic: string | null;
  musicVolume: number;
}

interface GenerationResult {
  audioUrl: string;
  meta: GenerationMeta;
}

// ---------------------------------------------------------------------------
// Step 1: Fetch meditation from DB and parse into segments
// ---------------------------------------------------------------------------

async function fetchAndParse(meditationId: string): Promise<MeditationData> {
  "use step";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("script, settings")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    throw new FatalError(`Meditation not found: ${error?.message ?? "no data"}`);
  }

  if (!meditation.script) {
    throw new FatalError("Meditation has no script to process");
  }

  const segments = parseMeditationText(meditation.script);

  if (segments.length === 0) {
    throw new FatalError("No valid segments found in meditation script");
  }

  const settings = meditation.settings ?? {};

  return {
    segments,
    voiceId: settings.voice ?? "EXAVITQu4vr4xnSDxMaL", // default: Sarah (calm, soothing)
    backgroundMusic: settings.music ?? null,
    musicVolume: settings.volume ?? 0.15,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Run audio generation in Vercel Sandbox, then upload result
//
// Combined into a single step to avoid serializing large audio buffers
// between steps. If this step fails, it retries from scratch (new sandbox).
// ---------------------------------------------------------------------------

async function generateAndUpload(
  meditationId: string,
  data: MeditationData,
): Promise<GenerationResult> {
  "use step";

  const snapshotId = process.env.AUDIO_SANDBOX_SNAPSHOT_ID;
  if (!snapshotId) {
    throw new FatalError("AUDIO_SANDBOX_SNAPSHOT_ID not configured");
  }

  const sandbox = await Sandbox.create({
    runtime: "node22",
    source: { type: "snapshot", snapshotId },
    timeout: 5 * 60 * 1000, // 5 minutes
  });

  try {
    const config = JSON.stringify({
      segments: data.segments,
      voiceId: data.voiceId,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      backgroundMusic: data.backgroundMusic,
      musicVolume: data.musicVolume,
    });

    await sandbox.writeFiles([
      { path: "config.json", content: Buffer.from(config) },
    ]);

    const cmdResult = await sandbox.runCommand("node", ["generate-audio.js"]);

    if (cmdResult.exitCode !== 0) {
      const stderr = await cmdResult.stderr();
      throw new Error(`Audio generation failed (exit ${cmdResult.exitCode}): ${stderr}`);
    }

    const audioBuffer = await sandbox.readFileToBuffer({ path: "output.mp3" });
    if (!audioBuffer) {
      throw new Error("output.mp3 not found in sandbox after generation");
    }

    let meta: GenerationMeta = {};
    const resultBuffer = await sandbox.readFileToBuffer({ path: "result.json" });
    if (resultBuffer) {
      const raw = JSON.parse(resultBuffer.toString("utf-8"));
      meta = {
        tts_characters: raw.ttsCharacters,
        tts_requests: raw.ttsRequests,
        processing_time_ms: raw.processingTimeMs,
        generated_at: raw.generatedAt,
      };
    }

    const audioUrl = await uploadAudio(meditationId, audioBuffer);
    return { audioUrl, meta };
  } finally {
    await sandbox.stop({ blocking: true }).catch(() => {});
  }
}

generateAndUpload.maxRetries = 2;

// ---------------------------------------------------------------------------
// Step 3: Mark meditation as completed with the audio URL
// ---------------------------------------------------------------------------

async function finalize(
  meditationId: string,
  audioUrl: string,
  meta: GenerationMeta,
): Promise<void> {
  "use step";

  await updateMeditationStatus(meditationId, "completed", audioUrl, meta);
}

// ---------------------------------------------------------------------------
// Step: Mark meditation as failed
// ---------------------------------------------------------------------------

async function markFailed(meditationId: string, reason: string): Promise<void> {
  "use step";

  console.error(`Audio generation failed for ${meditationId}: ${reason}`);
  await updateMeditationStatus(meditationId, "failed");
}

// ---------------------------------------------------------------------------
// Workflow: Orchestrate the full audio generation pipeline
// ---------------------------------------------------------------------------

export async function processAudioWorkflow(
  meditationId: string,
  voiceIdOverride: string | null = null,
) {
  "use workflow";

  try {
    const data = await fetchAndParse(meditationId);
    if (voiceIdOverride) {
      data.voiceId = voiceIdOverride;
    }
    const { audioUrl, meta } = await generateAndUpload(meditationId, data);
    await finalize(meditationId, audioUrl, meta);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(meditationId, message);
    throw err;
  }
}
