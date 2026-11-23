/**
 * How often the studio's first draft passes the pacing check: counts and
 * breath counts written as their own lines with their own PAUSE, not as
 * "ten... nine... eight" (src/lib/meditation/pacing.ts). Each brief is one
 * model step that ends at the first writeScript; no images, no audio, no
 * database.
 *
 *   STUDIO_MODEL=claude-sonnet-5-5 npx tsx scripts/measure-pacing.ts [samples] [--save <dir>]
 *
 * Calls the real Anthropic API with the route's prompt, tools and settings
 * (src/lib/chat/model.ts): a few cents per brief on Sonnet. Progress goes to
 * stderr, a summary to stdout.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { isStepCount, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { STUDIO_SYSTEM_PROMPT } from "../src/lib/ai/prompts";
import { findPacingIssues, pacingNote } from "../src/lib/meditation/pacing";
import { studioTools, type StudioToolContext } from "../src/lib/chat/tools";
import { studioModel, studioProviderOptions } from "../src/lib/chat/model";

config({ path: ".env.local", quiet: true });

const BRIEFS = [
  "A 10-minute meditation to fall asleep, with a slow countdown from ten to one",
  "5 minutes of box breathing before a presentation",
  "4-7-8 breathing to calm my anxiety, 5 minutes",
  "A breathing exercise: in for four, out for six. 5 minutes.",
  "A 10-minute sleep meditation that counts my breaths down",
  "A 5-minute reset at my desk",
];

async function firstDraft(brief: string): Promise<string | null> {
  const model = studioModel();
  let script: string | null = null;
  // The same tool list the route sends, so the model sees what it sees in
  // production; writeScript only records the draft. Nothing else runs,
  // since the run stops after the first step.
  const tools = {
    ...studioTools,
    writeScript: {
      ...studioTools.writeScript,
      execute: async (input: { script: string }) => {
        script = input.script;
        return { ok: true };
      },
    },
  };
  const ctx = { supabase: {}, userId: "u", chatId: "c" } as StudioToolContext;
  const result = streamText({
    model: createAnthropic()(model),
    instructions: { role: "system", content: STUDIO_SYSTEM_PROMPT },
    messages: [{ role: "user", content: brief }],
    tools,
    toolsContext: { writeScript: ctx, setDetails: ctx, makeCover: ctx },
    stopWhen: isStepCount(1),
    maxOutputTokens: 8000,
    providerOptions: studioProviderOptions(model),
  });
  await result.consumeStream();
  await result.steps;
  return script;
}

async function main() {
  const samples = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 1);
  const saveAt = process.argv.indexOf("--save");
  const saveDir = saveAt > 0 ? process.argv[saveAt + 1] : undefined;
  const runs = BRIEFS.flatMap((brief, b) => Array.from({ length: samples }, (_, s) => ({ brief, b, s })));
  const results = await Promise.all(
    runs.map(async ({ brief, b, s }) => {
      const script = await firstDraft(brief);
      const issues = script ? findPacingIssues(script) : [];
      if (saveDir && script) {
        mkdirSync(saveDir, { recursive: true });
        writeFileSync(join(saveDir, `b${b}-s${s}.md`), `> ${brief}\n\n${script}\n`);
      }
      console.error(
        `b${b} s${s} ${script ? (issues.length ? `FAIL ${issues.length}` : "pass") : "no draft"}`,
        issues.map(pacingNote).join(" | ").slice(0, 400),
      );
      return { brief, sample: s, drafted: script !== null, passed: script !== null && issues.length === 0, issues };
    }),
  );
  const drafted = results.filter((r) => r.drafted);
  console.log(
    JSON.stringify(
      {
        model: studioModel(),
        drafts: drafted.length,
        passed: drafted.filter((r) => r.passed).length,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
