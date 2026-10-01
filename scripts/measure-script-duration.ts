/**
 * Generate meditation scripts at several durations and report how close each
 * lands to what was asked for.
 *
 * Task 16 exists because scripts come out short, and "feels about right" is
 * not a way to tell whether a prompt change fixed it. This makes the check
 * repeatable: run it, change the prompt, run it again, compare the numbers.
 *
 *   npx tsx scripts/measure-script-duration.ts
 *   npx tsx scripts/measure-script-duration.ts --durations 5,30 --samples 2
 *   npx tsx scripts/measure-script-duration.ts --save baseline.json
 *   npx tsx scripts/measure-script-duration.ts --compare baseline.json
 *
 * This calls the real Anthropic API and costs real money -- roughly a cent per
 * sample at Sonnet 5 pricing. It does not touch the database, production, or
 * any generation quota: it calls the model directly with the same system
 * prompt and settings as `/api/generate`, deliberately bypassing the route so
 * a measurement run cannot burn a user's monthly allowance.
 */
import { config } from "dotenv";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { MEDITATION_SYSTEM_PROMPT, buildMeditationPrompt } from "../src/lib/ai/prompts";
import { checkDuration, formatDuration } from "../src/lib/meditation/duration";

config({ path: ".env.local" });

const DEFAULT_DURATIONS = [5, 15, 30, 60];

type Row = {
  minutes: number;
  sample: number;
  totalSeconds: number;
  ratio: number;
  speechSeconds: number;
  pauseSeconds: number;
  silenceSeconds: number;
  speechRatio: number;
  withinTolerance: boolean;
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function generate(minutes: number): Promise<string> {
  // Mirrors src/app/api/generate/route.ts. Keep in sync -- measuring a
  // different configuration than the one that ships would be worse than not
  // measuring at all.
  const result = streamText({
    model: anthropic("claude-sonnet-5"),
    system: MEDITATION_SYSTEM_PROMPT,
    prompt: buildMeditationPrompt({ type: "guided", duration: minutes }),
    maxOutputTokens: 8000,
    providerOptions: {
      anthropic: { thinking: { type: "adaptive" }, effort: "low" },
    },
  });

  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  return text;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (looked in .env.local)");
    process.exit(1);
  }

  const durations = (arg("--durations") ?? DEFAULT_DURATIONS.join(","))
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => Number.isInteger(d) && d > 0);
  const samples = parseInt(arg("--samples") ?? "1", 10);

  console.log(
    `Generating ${durations.length * samples} script(s): ` +
      `${durations.join(", ")} min x ${samples} sample(s)\n`,
  );

  const rows: Row[] = [];
  for (const minutes of durations) {
    for (let sample = 1; sample <= samples; sample++) {
      process.stdout.write(`  ${minutes} min (sample ${sample})... `);
      const script = await generate(minutes);
      const c = checkDuration(script, minutes);
      rows.push({
        minutes,
        sample,
        totalSeconds: c.totalSeconds,
        ratio: c.ratio,
        speechSeconds: c.speechSeconds,
        pauseSeconds: c.pauseSeconds,
        silenceSeconds: c.silenceSeconds,
        speechRatio: c.speechRatio,
        withinTolerance: c.withinTolerance,
      });
      console.log(
        `${formatDuration(c.totalSeconds)} (${pct(c.ratio)} of target)` +
          `${c.withinTolerance ? "" : "  <-- OUT OF TOLERANCE"}`,
      );
    }
  }

  console.log(
    `\n${"req".padStart(5)} ${"actual".padStart(12)} ${"vs target".padStart(10)} ` +
      `${"speech".padStart(8)} ${"pause".padStart(7)} ${"silence".padStart(8)} ${"speech%".padStart(8)}`,
  );
  console.log("-".repeat(64));
  for (const r of rows) {
    console.log(
      `${String(r.minutes).padStart(5)} ${formatDuration(r.totalSeconds).padStart(12)} ` +
        `${pct(r.ratio).padStart(10)} ${formatDuration(r.speechSeconds).padStart(8)} ` +
        `${(r.pauseSeconds + "s").padStart(7)} ${formatDuration(r.silenceSeconds).padStart(8)} ` +
        `${pct(r.speechRatio).padStart(8)}`,
    );
  }

  const inTol = rows.filter((r) => r.withinTolerance).length;
  const meanRatio = rows.reduce((a, r) => a + r.ratio, 0) / rows.length;
  console.log(
    `\n${inTol}/${rows.length} within +/-20%.  mean ${pct(meanRatio)} of target.`,
  );

  const save = arg("--save");
  if (save) {
    writeFileSync(save, JSON.stringify(rows, null, 2));
    console.log(`\nSaved to ${save}`);
  }

  const compare = arg("--compare");
  if (compare && existsSync(compare)) {
    const before: Row[] = JSON.parse(readFileSync(compare, "utf8"));
    const beforeMean = before.reduce((a, r) => a + r.ratio, 0) / before.length;
    const beforeIn = before.filter((r) => r.withinTolerance).length;
    console.log(`\nvs ${compare}:`);
    console.log(`  mean of target:  ${pct(beforeMean)} -> ${pct(meanRatio)}`);
    console.log(`  within +/-20%:   ${beforeIn}/${before.length} -> ${inTol}/${rows.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
