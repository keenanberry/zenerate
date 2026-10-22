import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TAG_GROUPS } from "@/lib/meditation/tags";
import { coverDesign, hashId, MeditationCover, tagGroupOf } from "./meditation-cover";

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

  it("takes its hues from the first tag's group", () => {
    expect(tagGroupOf(TAG_GROUPS.themes[0])).toBe("themes");
    expect(tagGroupOf(TAG_GROUPS.practices[0])).toBe("practices");
    expect(tagGroupOf(TAG_GROUPS.moments[0])).toBe("moments");
    expect(coverDesign(ID, ["breathwork", "sleep"]).group).toBe("practices");
    expect(coverDesign(ID, ["sleep", "breathwork"]).group).toBe("themes");
  });

  it("draws a quiet cover for untagged and unknown tags", () => {
    expect(coverDesign(ID, []).group).toBe("none");
    expect(coverDesign(ID, ["retired-tag"]).group).toBe("none");
    expect(render(ID, [])).toContain("text-muted-foreground");
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
});
