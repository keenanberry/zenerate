import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { processAudioWorkflow } from "@/lib/audio/workflow";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meditationId } = await req.json();

  if (!meditationId || typeof meditationId !== "string") {
    return NextResponse.json(
      { error: "meditationId is required" },
      { status: 400 },
    );
  }

  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("id, user_id, status")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    return NextResponse.json(
      { error: "Meditation not found" },
      { status: 404 },
    );
  }

  if (meditation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (meditation.status !== "script_ready") {
    return NextResponse.json(
      {
        error: `Cannot generate audio: meditation status is "${meditation.status}", expected "script_ready"`,
      },
      { status: 409 },
    );
  }

  const { error: updateError } = await supabase
    .from("meditations")
    .update({ status: "processing_audio", updated_at: new Date().toISOString() })
    .eq("id", meditationId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update meditation status" },
      { status: 500 },
    );
  }

  const run = await start(processAudioWorkflow, [meditationId]);

  return NextResponse.json(
    { meditationId, runId: run.runId, status: "processing_audio" },
    { status: 202 },
  );
}
