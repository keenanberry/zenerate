import { describe, expect, it, vi } from "vitest";
import type { LanguageModelUsage } from "ai";
import {
  DEFAULT_STUDIO_MODEL,
  narrowsToolsForAudio,
  studioModel,
  studioProviderOptions,
  usageCost,
} from "./model";

function usage(input: number, cacheRead: number, cacheWrite: number, output: number): LanguageModelUsage {
  return {
    inputTokens: input + cacheRead + cacheWrite,
    inputTokenDetails: { noCacheTokens: input, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
    totalTokens: input + cacheRead + cacheWrite + output,
  };
}

describe("studioModel", () => {
  it("defaults to Sonnet 5", () => {
    expect(studioModel(undefined)).toBe("claude-sonnet-5");
    expect(studioModel("")).toBe(DEFAULT_STUDIO_MODEL);
  });

  it("takes a known override", () => {
    expect(studioModel("claude-haiku-5-5")).toBe("claude-haiku-5-5");
    expect(studioModel("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
  });

  it("falls back on an unknown value instead of failing the turn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(studioModel("claude-sonet-5-5")).toBe(DEFAULT_STUDIO_MODEL);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("studioProviderOptions", () => {
  it("sets low effort and adaptive thinking explicitly on every model", () => {
    for (const model of ["claude-sonnet-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const) {
      expect(studioProviderOptions(model).anthropic).toMatchObject({
        thinking: { type: "adaptive" },
        effort: "low",
        disableParallelToolUse: true,
      });
    }
  });

  it("asks for the refusal fallback on Sonnet 5.5 only", () => {
    expect(studioProviderOptions("claude-sonnet-5-5").anthropic).toHaveProperty("fallbacks", "default");
    expect(studioProviderOptions("claude-sonnet-5").anthropic).not.toHaveProperty("fallbacks");
    expect(studioProviderOptions("claude-haiku-5-5").anthropic).not.toHaveProperty("fallbacks");
  });
});

describe("narrowsToolsForAudio", () => {
  it("keeps the tool list fixed on models that bind thinking to it", () => {
    expect(narrowsToolsForAudio("claude-sonnet-5")).toBe(true);
    expect(narrowsToolsForAudio("claude-sonnet-5-5")).toBe(false);
    expect(narrowsToolsForAudio("claude-haiku-5-5")).toBe(false);
  });
});

describe("usageCost", () => {
  it("prices uncached input, cache writes, cache reads and output separately", () => {
    // 1M of each on Sonnet: $2 + $2.50 + $0.20 + $10.
    expect(usageCost("claude-sonnet-5", usage(1e6, 1e6, 1e6, 1e6))).toBeCloseTo(14.7);
    // Haiku 5.5 is a twentieth of that.
    expect(usageCost("claude-haiku-5-5", usage(1e6, 1e6, 1e6, 1e6))).toBeCloseTo(0.735);
  });
});
