import { describe, expect, it } from "vitest";
import { COVER_STYLE, coverPrompt, MAX_SUBJECT_CHARS } from "./prompt";

describe("coverPrompt", () => {
  it("is the exact approved style line", () => {
    expect(COVER_STYLE).toBe(
      "Full-bleed square photograph filling the whole frame edge to edge. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.",
    );
  });

  it("never frames the picture as an app or an icon, which FLUX draws as a rounded tile on white", () => {
    expect(COVER_STYLE).not.toMatch(/\bapp\b|icon/i);
  });

  it("puts the trimmed subject first and the style line after it", () => {
    expect(coverPrompt("  A misty pine forest at dawn.  \n")).toBe(
      `A misty pine forest at dawn. ${COVER_STYLE}`,
    );
  });

  it("caps the subject at 300 characters, never the style line", () => {
    expect(MAX_SUBJECT_CHARS).toBe(300);
    const long = "a".repeat(450);
    const prompt = coverPrompt(long);
    expect(prompt).toBe(`${"a".repeat(300)} ${COVER_STYLE}`);
    expect(prompt.endsWith(COVER_STYLE)).toBe(true);
  });

  it("trims after capping, so a cut never leaves a trailing space", () => {
    const subject = `${"a".repeat(299)} bbbb`;
    expect(coverPrompt(subject)).toBe(`${"a".repeat(299)} ${COVER_STYLE}`);
  });
});
