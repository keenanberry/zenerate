import type { LanguageModelUsage } from "ai";

/**
 * The models the studio has been measured on (task 47). The route and
 * scripts/measure-studio-rewrites.ts both read the model and its settings
 * from here, so a measurement runs exactly what production runs.
 */
export const STUDIO_MODELS = ["claude-sonnet-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;

export type StudioModel = (typeof STUDIO_MODELS)[number];

export const DEFAULT_STUDIO_MODEL: StudioModel = "claude-sonnet-5";

function isStudioModel(value: string): value is StudioModel {
  return (STUDIO_MODELS as readonly string[]).includes(value);
}

/**
 * `STUDIO_MODEL` overrides the default. An unknown value falls back to the
 * default with a warning rather than failing every chat turn on a typo.
 */
export function studioModel(env: string | undefined = process.env.STUDIO_MODEL): StudioModel {
  if (env === undefined || env === "") return DEFAULT_STUDIO_MODEL;
  if (isStudioModel(env)) return env;
  console.warn(
    `[chat] STUDIO_MODEL "${env}" is not one of ${STUDIO_MODELS.join(", ")}; using ${DEFAULT_STUDIO_MODEL}`,
  );
  return DEFAULT_STUDIO_MODEL;
}

/**
 * Anthropic options for a studio turn.
 *
 * - Adaptive thinking at low effort, set on purpose: omitting `thinking` runs
 *   adaptive anyway on all three, and Haiku 5.5 defaults to `medium` effort.
 *   Low keeps the structural planning a script needs (arc, silence budget)
 *   without a long pause before the canvas starts filling.
 * - One tool per step. In parallel, setDetails can run before the
 *   writeScript that creates the meditation it writes to.
 * - Sonnet 5.5 gets the server-side refusal fallback. Haiku 5.5 has none,
 *   and Sonnet 5 is the fallback target itself.
 */
export function studioProviderOptions(model: StudioModel) {
  return {
    anthropic: {
      thinking: { type: "adaptive" as const },
      effort: "low" as const,
      disableParallelToolUse: true,
      ...(model === "claude-sonnet-5-5" && { fallbacks: "default" as const }),
    },
  };
}

/**
 * Whether the "Make the audio" step may narrow the tools to offerAudio.
 * Sonnet 5.5 and Haiku 5.5 bind each thinking block to the `tools` list it
 * was made with, and a shorter list on that step is a history edit: a 400
 * wherever the check is enforced (accounts created on or after 2026-08-31).
 */
export function narrowsToolsForAudio(model: StudioModel): boolean {
  return model === "claude-sonnet-5";
}

/** USD per million tokens, Anthropic list prices (prompts under 100K tokens). */
const PRICES: Record<StudioModel, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

/** What a turn cost in dollars, from `streamText`'s total usage. */
export function usageCost(model: StudioModel, usage: LanguageModelUsage): number {
  const price = PRICES[model];
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const uncached =
    usage.inputTokenDetails.noCacheTokens ?? (usage.inputTokens ?? 0) - cacheRead - cacheWrite;
  return (
    (uncached * price.input +
      cacheWrite * price.cacheWrite +
      cacheRead * price.cacheRead +
      (usage.outputTokens ?? 0) * price.output) /
    1_000_000
  );
}

/** One log line per turn, so real cost per meditation can be read from the logs. */
export function usageLogLine(model: StudioModel, usage: LanguageModelUsage, steps: number) {
  return {
    model,
    steps,
    inputTokens: usage.inputTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
    costUsd: Math.round(usageCost(model, usage) * 1e5) / 1e5,
  };
}
