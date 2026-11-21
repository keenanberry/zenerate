import { describe, expect, it } from "vitest";
import { COVER_STYLE, COVER_STYLES, coverPrompt, MAX_SUBJECT_CHARS } from "./prompt";

const PHOTOGRAPH =
  "Full-bleed square photograph filling the whole frame edge to edge. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.";
const ILLUSTRATION =
  "Full-bleed square illustration filling the whole frame edge to edge. Soft storybook illustration, gentle painterly textures, warm calm colours, friendly and simple shapes, one clear subject with room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.";

describe("coverPrompt", () => {
  it("has exactly the approved style lines", () => {
    expect(COVER_STYLES).toEqual({ photograph: PHOTOGRAPH, illustration: ILLUSTRATION });
    expect(COVER_STYLE).toBe(PHOTOGRAPH);
  });

  it("never frames the picture as an app or an icon, which FLUX draws as a rounded tile on white", () => {
    for (const line of Object.values(COVER_STYLES)) expect(line).not.toMatch(/\bapp\b|icon/i);
  });

  it("puts the trimmed subject first and the photograph line after it by default", () => {
    expect(coverPrompt("  A misty pine forest at dawn.  \n")).toBe(`A misty pine forest at dawn. ${PHOTOGRAPH}`);
    expect(coverPrompt("A still lake.", "photograph")).toBe(`A still lake. ${PHOTOGRAPH}`);
  });

  it("ends with the illustration line for an illustration", () => {
    expect(coverPrompt(" A small dragon asleep on a cloud. ", "illustration")).toBe(
      `A small dragon asleep on a cloud. ${ILLUSTRATION}`,
    );
  });

  it("caps the subject at 300 characters, never the style line", () => {
    expect(MAX_SUBJECT_CHARS).toBe(300);
    const long = "a".repeat(450);
    expect(coverPrompt(long)).toBe(`${"a".repeat(300)} ${PHOTOGRAPH}`);
    expect(coverPrompt(long, "illustration")).toBe(`${"a".repeat(300)} ${ILLUSTRATION}`);
  });

  it("trims after capping, so a cut never leaves a trailing space", () => {
    const subject = `${"a".repeat(299)} bbbb`;
    expect(coverPrompt(subject)).toBe(`${"a".repeat(299)} ${PHOTOGRAPH}`);
  });
});
