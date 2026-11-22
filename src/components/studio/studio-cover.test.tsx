import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftChipCover } from "./chat";
import type { CoverState, Details } from "./drafts";
import { CanvasCover } from "./script-canvas";

const details: Details = { title: "Evening wind-down", tags: ["sleep"] };
const URL = "https://x.supabase.co/storage/v1/object/public/meditation-covers/m1/c1.webp";
const expected: CoverState = { url: null, status: "expected", making: false };
const fallback: CoverState = { url: null, status: "fallback", making: false };
const photo: CoverState = { url: URL, status: "photo", making: false };

const canvas = (cover: CoverState) =>
  renderToStaticMarkup(<CanvasCover meditationId="m1" details={details} cover={cover} />);
const chip = (cover: CoverState, writing = false) =>
  renderToStaticMarkup(
    <DraftChipCover id="m1" details={details} title="Draft 1" cover={cover} hasMeditation writing={writing} />,
  );

describe("the studio's cover while one is on its way", () => {
  it("draws a quiet tile and a spinner on the canvas, with no designed cover behind it", () => {
    const html = canvas(expected);
    expect(html).toContain('data-cover="expected"');
    expect(html).toContain("bg-muted");
    expect(html).toContain("animate-spin");
    expect(html).not.toContain("data-motif");
    expect(html).toContain("Making a cover");
  });

  it("draws the same tile in the chat's draft chip", () => {
    const html = chip(expected, true);
    expect(html).toContain('data-cover="expected"');
    expect(html).toContain("animate-spin");
    expect(html).not.toContain("data-motif");
  });

  it("draws the designed cover once none is coming", () => {
    for (const html of [canvas(fallback), chip(fallback)]) {
      expect(html).toContain("data-motif");
      expect(html).not.toContain('data-cover="expected"');
      expect(html).not.toContain("animate-spin");
    }
    expect(canvas(fallback)).not.toContain("Making a cover");
  });

  it("draws the photo, and a scrim over it while a new one is made", () => {
    const html = canvas(photo);
    expect(html).toContain(`.thumb.webp`);
    expect(html).not.toContain("data-motif");
    expect(html).not.toContain("animate-spin");
    const making = canvas({ ...photo, making: true });
    expect(making).toContain("bg-muted/70");
    expect(making).toContain("Making a cover");
    expect(chip(photo)).toContain(".thumb.webp");
  });
});
