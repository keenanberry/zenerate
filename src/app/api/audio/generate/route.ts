import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { processAudioWorkflow } from "@/lib/audio/workflow";
import { reserveAudioGeneration, getQuotaConfig } from "@/lib/audio/quota";

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
    .select("id, user_id, status")
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
    .update({ status: "processing_audio", updated_at: new Date().toISOString() })
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

  const run = await start(processAudioWorkflow, [
    meditationId,
    voiceId ?? null,
    reserve.eventId,
  ]);

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
