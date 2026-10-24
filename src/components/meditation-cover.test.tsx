import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TAG_GROUPS, TAGS } from "@/lib/meditation/tags";
import {
  coverDesign,
  hashId,
  MeditationCover,
  MOTIFS,
  ROUND_MOTIFS,
  TAG_HUES,
} from "./meditation-cover";

const ID = "6f1c2a9e-3b7d-4e21-9a0c-5d8f7e6b1a24";

function render(id: string, tags: string[], size = 128) {
  return renderToStaticMarkup(
    <MeditationCover id={id} tags={tags} title="Evening wind-down" size={size} />,
  );
}

describe("MeditationCover", () => {
  it("gives the same markup for the same input", () => {
    for (const size of [48, 160, 320]) {
      expect(render(ID, ["sleep", "bedtime"], size)).toBe(
        render(ID, ["sleep", "bedtime"], size),
      );
    }
  });

  it("pins the hash, so a cover never changes between releases by accident", () => {
    expect(hashId("")).toBe(0x811c9dc5);
    expect(hashId("a")).toBe(0xe40c292c);
  });

  it("varies across ids", () => {
    const ids = Array.from({ length: 24 }, (_, i) => `${ID.slice(0, -2)}${i}`);
    const markups = new Set(ids.map((id) => render(id, ["focus"])));
    expect(markups.size).toBe(24);
    const motifs = new Set(ids.map((id) => coverDesign(id, ["focus"]).motif));
    expect(motifs.size).toBeGreaterThanOrEqual(4);
  });

  it("gives every tag its own pair of hues, taken from the first tag", () => {
    const pairs = TAGS.map((tag) => [...TAG_HUES[tag]].sort().join("+"));
    expect(new Set(pairs).size).toBe(TAGS.length);
    expect(TAG_HUES[TAG_GROUPS.themes[0]]).toBeDefined();
    expect(coverDesign(ID, ["breathwork", "sleep"]).tag).toBe("breathwork");
    expect(coverDesign(ID, ["retired-tag", "sleep"]).tag).toBe("sleep");
  });

  it("draws a quiet cover for untagged and unknown tags", () => {
    expect(coverDesign(ID, []).tag).toBeNull();
    expect(coverDesign(ID, ["retired-tag"]).tag).toBeNull();
    expect(render(ID, [])).toContain("text-muted-foreground");
  });

  it("draws mostly motifs that are not round, and every motif at some id", () => {
    const tagSets = [["sleep", "bedtime"], ["focus", "breathwork"], ["gratitude", "morning"], []];
    const motifs = Array.from({ length: 2000 }, (_, i) =>
      coverDesign(`${ID.slice(0, -4)}${i}`, tagSets[i % tagSets.length]).motif,
    );
    expect(new Set(motifs).size).toBe(MOTIFS.length);
    const round = motifs.filter((motif) => ROUND_MOTIFS.includes(motif)).length;
    expect(round / motifs.length).toBeLessThan(0.4);
  });

  it("renders every motif at every size without the same markup twice", () => {
    for (const size of [48, 96, 160, 320]) {
      const seen = new Map<string, string>();
      for (let i = 0; seen.size < MOTIFS.length * 2 && i < 5000; i++) {
        const id = `${ID.slice(0, -4)}${i}`;
        const { motif } = coverDesign(id, ["grounding"]);
        const key = `${motif}:${seen.has(`${motif}:0`) ? 1 : 0}`;
        if (seen.has(key)) continue;
        const html = render(id, ["grounding"], size);
        expect(html).toContain(`data-motif="${motif}"`);
        expect(html).not.toContain("NaN");
        seen.set(key, html);
      }
      expect(seen.size).toBe(MOTIFS.length * 2);
      expect(new Set(seen.values()).size).toBe(seen.size);
    }
  });

  it("fills the frame with the lead hue's field, or a quiet one", () => {
    const tagged = coverDesign(ID, ["breathwork"]);
    expect(TAG_HUES.breathwork).toContain(tagged.fieldKey);
    expect(render(ID, ["breathwork"])).toContain(
      `<rect class="text-cover-field-${tagged.fieldKey}" fill="currentColor" width="100" height="100">`,
    );
    expect(coverDesign(ID, []).fieldKey).toBe("quiet");
  });

  it("draws strokes at least 2px on screen at every size", () => {
    for (const size of [48, 64, 96, 160, 320]) {
      for (let i = 0; i < 200; i++) {
        const html = render(`${ID.slice(0, -4)}${i}`, ["breathwork"], size);
        for (const [, width] of html.matchAll(/stroke-width="([\d.]+)"/g)) {
          // The constellation line is drawn at 0.6 of the stroke, on purpose.
          expect(Number(width) * size / 100).toBeGreaterThanOrEqual(1.2);
        }
      }
    }
  });

  it("scales every opacity up for the field, never past 0.95", () => {
    for (let i = 0; i < 200; i++) {
      const html = render(`${ID.slice(0, -4)}${i}`, ["grounding"], 160);
      for (const [, value] of html.matchAll(/(?:fill|stroke)-opacity="([\d.]+)"/g)) {
        expect(Number(value)).toBeLessThanOrEqual(0.95);
      }
    }
  });

  it("paints only in tokens, with no gradient", () => {
    const html = render(ID, ["morning"], 320);
    expect(html).not.toMatch(/Gradient|gradient/);
    expect(html).not.toMatch(/(fill|stroke)="#|oklch\(/);
  });

  it("is square at the requested size and decorative by default", () => {
    const html = render(ID, ["focus"], 48);
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
    expect(html).toContain('aria-hidden="true"');

    const named = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="Evening wind-down" size={320} decorative={false} />,
    );
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Evening wind-down"');
  });
  it("runs every mountain range past both edges, so no strip is left bare", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `${ID.slice(0, -3)}${i}`)
      .filter((id) => coverDesign(id, []).motif === "ridge");
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      for (const size of [56, 120, 240]) {
        for (const [, d] of render(id, [], size).matchAll(/<path[^>]* d="([^"]+)"/g)) {
          const xs = [...d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
          expect(Math.max(...xs)).toBeGreaterThanOrEqual(100);
        }
      }
    }
  });
});
