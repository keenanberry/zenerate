import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MEDITATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import {
  getScriptQuotaConfig,
  reserveScriptGeneration,
  MAX_PROMPT_CHARS,
} from "@/lib/ai/quota";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prompt: unknown = body?.prompt;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "prompt is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `prompt must be ${MAX_PROMPT_CHARS} characters or fewer` },
      { status: 400 },
    );
  }

  const reserve = await reserveScriptGeneration(
    user.id,
    createServiceClient(),
    getScriptQuotaConfig(),
  );

  if (!reserve.ok) {
    if (reserve.reason === "quota_exceeded") {
      return NextResponse.json(
        { error: "You've reached your monthly script generation limit." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Script generation is temporarily unavailable. Try again next month." },
      { status: 503 },
    );
  }

  const result = streamText({
    model: anthropic("claude-sonnet-5"),
    system: MEDITATION_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 8000,
    providerOptions: {
      anthropic: {
        // Both of these are set deliberately rather than left to default.
        //
        // On claude-sonnet-4-6, omitting `thinking` meant no thinking at all.
        // On Sonnet 5 the same omission runs ADAPTIVE thinking, so the model
        // swap would have silently turned it on. That matters here because
        // this route streams to the create wizard: thinking blocks stream
        // with empty text, so the user watches a blank panel until reasoning
        // finishes, and the thinking tokens bill at output rates.
        //
        // Low effort keeps some structural reasoning -- a meditation has an
        // arc, and pacing the pauses against a requested duration is real
        // work -- without the long pre-stream pause. Writing a meditation
        // script is a creative task, not a reasoning-heavy one, so the top of
        // the effort range buys little here. Revisit alongside task 16
        // (duration constraints), which is the part that would most benefit
        // from more deliberation.
        thinking: { type: "adaptive" },
        effort: "low",
      },
    },
  });

  return result.toTextStreamResponse();
}
