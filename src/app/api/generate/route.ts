import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MEDITATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: MEDITATION_SYSTEM_PROMPT,
    prompt,
  });

  return result.toTextStreamResponse();
}
