import { FatalError } from "workflow";

import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@supabase/supabase-js";
import { parseMeditationText } from "@/lib/meditation/parser";
import { uploadAudio, updateMeditationStatus } from "./storage";
import type {
  MeditationSegment,
  GenerationMeta,
  MeditationSettings,
} from "@/lib/meditation/types";
import { DEFAULT_VOICE_ID } from "@/lib/voices/catalog";

interface MeditationData {
  /** The owner, whose folder the audio is uploaded into. */
  userId: string;
  segments: MeditationSegment[];
  voiceId: string;
  backgroundMusic: string | null;
  musicVolume: number;
  /**
   * The revision being rendered, when there is one. finalize promotes it to
   * the script and archives the version it replaces, so the saved script is
   * always the one that was narrated.
   */
  renderedDraft: string | null;
}

interface GenerationResult {
  audioPath: string;
  meta: GenerationMeta;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function fetchAndParse(meditationId: string): Promise<MeditationData> {
  "use step";

  const supabase = serviceClient();
  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("user_id, script, settings")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    throw new FatalError(`Meditation not found: ${error?.message ?? "no data"}`);
  }
  // A revision made after the audio lives in meditation_drafts; render it in
  // place of the current script. writeScript refuses while a render is in
  // flight, so the draft cannot change under this run.
  const draft = await readDraft(supabase, meditationId);
  const script: string | null = draft?.script ?? meditation.script;
  if (!script) {
    throw new FatalError("Meditation has no script to process");
  }

  const segments = parseMeditationText(script);
  if (segments.length === 0) {
    throw new FatalError("No valid segments found in meditation script");
  }

  const settings = meditation.settings ?? {};
  return {
    userId: meditation.user_id,
    segments,
    voiceId: settings.voice ?? DEFAULT_VOICE_ID,
    backgroundMusic: settings.music ?? null,
    musicVolume: settings.volume ?? 0.15,
    renderedDraft: draft?.script ?? null,
  };
}

type Draft = { script: string; render_status: "processing" | "failed" | null };

/** The meditation's draft, or null when it has none. */
async function readDraft(
  supabase: ReturnType<typeof serviceClient>,
  meditationId: string,
): Promise<Draft | null> {
  const { data, error } = await supabase
    .from("meditation_drafts")
    .select("script, render_status")
    .eq("meditation_id", meditationId)
    .maybeSingle();
  if (error) throw new Error(`Reading the draft failed: ${error.message}`);
  return (data as Draft | null) ?? null;
}

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
    timeout: 5 * 60 * 1000,
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

    const audioPath = await uploadAudio(data.userId, meditationId, audioBuffer);
    return { audioPath, meta };
  } finally {
    await sandbox.stop({ blocking: true }).catch(() => {});
  }
}

generateAndUpload.maxRetries = 2;

/**
 * Make a finished render of the draft the current version: archive the
 * version it replaces into meditation_versions, promote the draft, the new
 * audio and the voice it was narrated in, then delete the draft. The old
 * audio file stays, since the archived row points at it; the chat's Replace
 * (or the owner deleting the version) removes both.
 *
 * Safe to run twice, which a step retry can do, from any point: once the
 * draft is gone there is nothing left to do; once the meditation carries this
 * render's audio only the draft's deletion is left; and the archive insert is
 * skipped when the outgoing audio is already archived.
 */
async function promoteDraft(
  meditationId: string,
  renderedDraft: string,
  audioPath: string,
  meta: GenerationMeta,
  voiceId: string,
): Promise<void> {
  const supabase = serviceClient();
  const { data: current, error } = await supabase
    .from("meditations")
    .select("script, audio_path, settings, generation_meta")
    .eq("id", meditationId)
    .single();
  if (error || !current) {
    throw new Error(`Meditation not found: ${error?.message ?? "no data"}`);
  }
  const draft = await readDraft(supabase, meditationId);
  if (draft?.script !== renderedDraft) return;

  // audioPath is new on every render, so a meditation that already carries
  // it was promoted by an earlier attempt that stopped before the delete.
  if (current.audio_path !== audioPath) {
    await archiveAndPromote(supabase, meditationId, current, renderedDraft, audioPath, meta, voiceId);
  }

  const { error: deleteError } = await supabase
    .from("meditation_drafts")
    .delete()
    .eq("meditation_id", meditationId);
  if (deleteError) {
    throw new Error(`Clearing the promoted draft failed: ${deleteError.message}`);
  }
}

async function archiveAndPromote(
  supabase: ReturnType<typeof serviceClient>,
  meditationId: string,
  current: {
    script: string | null;
    audio_path: string | null;
    settings: unknown;
    generation_meta: unknown;
  },
  renderedDraft: string,
  audioPath: string,
  meta: GenerationMeta,
  voiceId: string,
): Promise<void> {
  const settings = (current.settings as MeditationSettings | null) ?? {};
  if (current.audio_path && current.script) {
    const { data: archived, error: archivedError } = await supabase
      .from("meditation_versions")
      .select("id")
      .eq("meditation_id", meditationId)
      .eq("audio_path", current.audio_path)
      .limit(1)
      .maybeSingle();
    if (archivedError) {
      throw new Error(`Reading versions failed: ${archivedError.message}`);
    }
    if (!archived) {
      const { error: insertError } = await supabase.from("meditation_versions").insert({
        meditation_id: meditationId,
        script: current.script,
        audio_path: current.audio_path,
        voice: settings.voice ?? null,
        generation_meta: current.generation_meta,
      });
      if (insertError) {
        throw new Error(`Archiving the version failed: ${insertError.message}`);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("meditations")
    .update({
      script: renderedDraft,
      status: "completed",
      audio_path: audioPath,
      generation_meta: meta,
      settings: { ...settings, voice: voiceId },
      updated_at: new Date().toISOString(),
    })
    .eq("id", meditationId);
  if (updateError) {
    throw new Error(`Promoting the draft failed: ${updateError.message}`);
  }
}

async function finalize(
  meditationId: string,
  audioPath: string,
  meta: GenerationMeta,
  eventId: string | null,
  renderedDraft: string | null,
  voiceId: string,
): Promise<void> {
  "use step";

  if (renderedDraft) {
    await promoteDraft(meditationId, renderedDraft, audioPath, meta, voiceId);
  } else {
    await updateMeditationStatus(meditationId, "completed", audioPath, meta);
  }
  if (eventId) {
    const supabase = serviceClient();
    await supabase
      .from("audio_generation_events")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", eventId);
  }
}

async function markFailed(
  meditationId: string,
  reason: string,
  eventId: string | null,
): Promise<void> {
  "use step";

  console.error(`Audio generation failed for ${meditationId}: ${reason}`);
  const supabase = serviceClient();
  // A draft render failed: the current version is still good, so the
  // meditation stays completed and only the draft render is marked. Anything
  // else has no audio to fall back on.
  const draft = await readDraft(supabase, meditationId);
  if (draft?.render_status === "processing") {
    const { error } = await supabase
      .from("meditation_drafts")
      .update({ render_status: "failed", updated_at: new Date().toISOString() })
      .eq("meditation_id", meditationId);
    if (error) throw new Error(`Status update failed: ${error.message}`);
  } else {
    await updateMeditationStatus(meditationId, "failed");
  }
  if (eventId) {
    await supabase
      .from("audio_generation_events")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", eventId);
  }
}

export async function processAudioWorkflow(
  meditationId: string,
  voiceIdOverride: string | null = null,
  eventId: string | null = null,
) {
  "use workflow";

  try {
    const data = await fetchAndParse(meditationId);
    if (voiceIdOverride) {
      data.voiceId = voiceIdOverride;
    }
    const { audioPath, meta } = await generateAndUpload(meditationId, data);
    await finalize(meditationId, audioPath, meta, eventId, data.renderedDraft, data.voiceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(meditationId, message, eventId);
    throw err;
  }
}
