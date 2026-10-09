import { describe, expect, it } from "vitest";
import { oklchToHex, parseColorTokens } from "./color";

describe("oklchToHex", () => {
  it("maps the ends of the lightness axis to black and white", () => {
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
  });

  it("matches the CSS Color 4 reference values for the sRGB primaries", () => {
    expect(oklchToHex("oklch(0.627955 0.257683 29.2339)")).toBe("#ff0000");
    expect(oklchToHex("oklch(0.866440 0.294827 142.4953)")).toBe("#00ff00");
    expect(oklchToHex("oklch(0.452014 0.313214 264.0520)")).toBe("#0000ff");
  });

  it("clamps an out-of-gamut colour instead of wrapping it", () => {
    expect(oklchToHex("oklch(0.9 0.4 145)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rejects anything that is not a bare oklch() triple", () => {
    expect(() => oklchToHex("#ffffff")).toThrow(/oklch/);
    expect(() => oklchToHex("oklch(0.5 0.1 300 / 0.5)")).toThrow(/oklch/);
  });
});

describe("parseColorTokens", () => {
  const markdown = [
    "---",
    "name: Zenerate",
    "colors:",
    "  # Dark theme",
    '  midnight: "oklch(0.2166 0.0215 292.8474)"',
    '  rose-quartz: "oklch(0.8391 0.0692 2.6681)"',
    "typography:",
    "  display:",
    '    fontFamily: "Lora, Georgia, serif"',
    "components:",
    "  button-primary-hover:",
    '    backgroundColor: "oklch(0.7058 0.0777 302.0489 / 0.9)"',
    "---",
    "",
    'colors: "oklch(0 0 0)" outside the frontmatter is ignored',
  ].join("\n");

  it("reads only the colors block of the frontmatter", () => {
    expect(parseColorTokens(markdown)).toEqual({
      midnight: "oklch(0.2166 0.0215 292.8474)",
      "rose-quartz": "oklch(0.8391 0.0692 2.6681)",
    });
  });

  it("fails loudly when there is no frontmatter", () => {
    expect(() => parseColorTokens("# Just a heading")).toThrow(/frontmatter/);
  });
});
