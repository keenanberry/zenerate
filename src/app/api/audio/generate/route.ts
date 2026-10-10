import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { processAudioWorkflow } from "@/lib/audio/workflow";
import { reserveAudioGeneration, getQuotaConfig } from "@/lib/audio/quota";
import { startRunOrRevert } from "@/lib/audio/start-run";
import { resolveVoiceId } from "@/lib/voices/catalog";
import { getVoices } from "@/lib/voices/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const meditationId: unknown = body?.meditationId;
  const voiceId: unknown = body?.voiceId;
  const retryOfEventId: unknown = body?.retryOfEventId ?? null;

  if (!meditationId || typeof meditationId !== "string") {
    return NextResponse.json(
      { error: "meditationId is required" },
      { status: 400 },
    );
  }
  if (retryOfEventId !== null && typeof retryOfEventId !== "string") {
    return NextResponse.json(
      { error: "retryOfEventId must be a string when provided" },
      { status: 400 },
    );
  }

  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("id, user_id, status, settings")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    return NextResponse.json({ error: "Meditation not found" }, { status: 404 });
  }
  if (meditation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowedStatus = retryOfEventId ? "failed" : "script_ready";
  if (meditation.status !== allowedStatus) {
    return NextResponse.json(
      {
        error: `Cannot generate audio: meditation status is "${meditation.status}", expected "${allowedStatus}"`,
      },
      { status: 409 },
    );
  }

  // Validate the voice before reserving quota, so a rejected request never
  // costs the user a generation. Only a requested voice needs the list; a
  // retry sends none and reuses the voice saved on the meditation.
  let allowedVoices = new Set<string>();
  if (voiceId !== undefined && voiceId !== null) {
    try {
      allowedVoices = new Set((await getVoices()).map((v) => v.voiceId));
    } catch (err) {
      console.error("Could not load voices:", err);
      return NextResponse.json(
        { error: "Voices are temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    }
  }
  const voice = resolveVoiceId(voiceId, allowedVoices);
  if (!voice.ok) {
    return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const reserve = await reserveAudioGeneration(
    { userId: user.id, meditationId, retryOfEventId },
    serviceClient,
    getQuotaConfig(),
  );

  if (!reserve.ok) {
    if (reserve.reason === "quota_exceeded") {
      return NextResponse.json(
        { error: "Monthly limit reached", remaining: 0 },
        { status: 429 },
      );
    }
    if (reserve.reason === "global_cap_reached") {
      return NextResponse.json(
        { error: "Audio generation is temporarily unavailable. Try again next month." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "This generation can't be retried for free." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("meditations")
    .update({
      status: "processing_audio",
      updated_at: new Date().toISOString(),
      // Saved so a free retry, which sends no voice, narrates in the same one.
      ...(voice.voiceId && {
        settings: { ...(meditation.settings ?? {}), voice: voice.voiceId },
      }),
    })
    .eq("id", meditationId);

  if (updateError) {
    // Refund the reserved slot so the user isn't charged for our failure.
    await serviceClient
      .from("audio_generation_events")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", reserve.eventId);
    return NextResponse.json(
      { error: "Failed to update meditation status" },
      { status: 500 },
    );
  }

  const run = await startRunOrRevert({
    start: () => start(processAudioWorkflow, [meditationId, voice.voiceId, reserve.eventId]),
    // No run exists, so the workflow's own failure path will never fire:
    // put the script back where it was and refund the reserved generation.
    revert: async () => {
      await Promise.all([
        serviceClient
          .from("meditations")
          .update({ status: allowedStatus, updated_at: new Date().toISOString() })
          .eq("id", meditationId),
        serviceClient
          .from("audio_generation_events")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", reserve.eventId),
      ]);
    },
  });

  if (!run.ok) {
    console.error(`Could not start the audio workflow for ${meditationId}:`, run.error);
    return NextResponse.json(
      {
        error:
          "Audio generation couldn't start. Nothing was used from your monthly allowance; try again in a minute.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      meditationId,
      runId: run.runId,
      eventId: reserve.eventId,
      status: "processing_audio",
    },
    { status: 202 },
  );
}
