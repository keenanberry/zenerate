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
    .select("id, user_id, status, settings, draft_script, draft_status")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    return NextResponse.json({ error: "Meditation not found" }, { status: 404 });
  }
  if (meditation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // A retry follows a failed render. Otherwise there must be a script with no
  // audio yet, or a revision (draft_script) made after the audio, which the
  // workflow renders in place of the current script.
  //
  // A revision of a meditation that has audio is a draft render: status stays
  // completed for its whole life, so the current version keeps playing for
  // everyone, and draft_status carries the render's own state instead.
  const draftStatus = meditation.draft_status as "processing" | "failed" | null;
  const draftRender = meditation.status === "completed" && meditation.draft_script !== null;
  const allowed = retryOfEventId
    ? meditation.status === "failed" || (draftRender && draftStatus === "failed")
    : meditation.status === "script_ready" || (draftRender && draftStatus !== "processing");
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          draftRender && draftStatus === "processing"
            ? "Audio is already being made for this meditation."
            : `Cannot generate audio: meditation status is "${meditation.status}"${retryOfEventId ? ", and only a failed render can be retried" : ""}`,
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

  // Compare-and-set on the state read above: of two requests that both
  // passed the check (a double click), only one flips the row, and the other
  // gives its reservation back.
  let flip = supabase
    .from("meditations")
    .update({
      updated_at: new Date().toISOString(),
      ...(draftRender
        ? // The voice is saved when the draft is promoted, not now: until
          // then settings describe the current version.
          { draft_status: "processing" }
        : {
            status: "processing_audio",
            // Saved so a free retry, which sends no voice, narrates in the same one.
            ...(voice.voiceId && {
              settings: { ...(meditation.settings ?? {}), voice: voice.voiceId },
            }),
          }),
    })
    .eq("id", meditationId)
    .eq("status", meditation.status);
  if (draftRender) {
    flip = draftStatus === null ? flip.is("draft_status", null) : flip.eq("draft_status", draftStatus);
  }
  const { data: flipped, error: updateError } = await flip.select("id");

  if (updateError || !flipped || flipped.length === 0) {
    // Refund the reserved slot so the user isn't charged for our failure.
    await serviceClient
      .from("audio_generation_events")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", reserve.eventId);
    if (!updateError) {
      return NextResponse.json(
        { error: "Audio is already being made for this meditation." },
        { status: 409 },
      );
    }
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
          .update({
            ...(draftRender ? { draft_status: draftStatus } : { status: meditation.status }),
            updated_at: new Date().toISOString(),
          })
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
      status: draftRender ? "completed" : "processing_audio",
      draftStatus: draftRender ? "processing" : null,
    },
    { status: 202 },
  );
}
