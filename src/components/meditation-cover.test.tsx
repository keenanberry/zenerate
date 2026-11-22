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
import { CoverImageView, coverSources } from "./cover-image";

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

describe("MeditationCover with a generated cover", () => {
  const URL = "https://abc.supabase.co/storage/v1/object/public/meditation-covers/m1/a.webp";

  it("leaves a cover without coverUrl exactly as it was", () => {
    const designed = render(ID, ["sleep"], 160);
    for (const coverUrl of [undefined, null, ""]) {
      expect(
        renderToStaticMarkup(
          <MeditationCover id={ID} tags={["sleep"]} title="Evening wind-down" size={160} coverUrl={coverUrl} />,
        ),
      ).toBe(designed);
    }
  });

  const THUMB = URL.replace(/\.webp$/, ".thumb.webp");
  const MIDDLE = URL.replace(/\.webp$/, ".md.webp");

  it("draws the photo, not the designed cover, at the same size and radius", () => {
    const html = renderToStaticMarkup(
      <MeditationCover id={ID} tags={["sleep"]} title="Evening wind-down" size={56} coverUrl={URL} />,
    );
    expect(html).toMatch(/^<span [^>]*><img /);
    expect(html).not.toContain("data-motif");
    expect(html).toContain('width="56"');
    expect(html).toContain('height="56"');
    // The frame reserves the 56px square and carries the radius.
    expect(html).toContain("--cover-size:56px");
    expect(html).toMatch(/^<span [^>]*rounded-md/);
    expect(html).toContain("object-cover");
  });

  it("holds a quiet tile until the photo loads, then fades it in", () => {
    const designed = <svg data-motif="moon" />;
    const view = (loaded: boolean) =>
      renderToStaticMarkup(
        <CoverImageView
          src={URL}
          size={56}
          alt=""
          className="rounded-md"
          failures={0}
          loaded={loaded}
          onLoad={() => {}}
          onError={() => {}}
          fallback={designed}
        />,
      );
    const before = view(false);
    expect(before).toMatch(/^<span [^>]*bg-muted/);
    expect(before).toContain("opacity-0");
    expect(before).not.toContain("data-loaded");
    expect(before).not.toContain("data-motif");
    const after = view(true);
    expect(after).toContain('data-loaded="true"');
    expect(after).toContain("opacity-100");
    expect(after).not.toContain("opacity-0");
    // The fade is motion-safe only: reduced motion shows the photo at once.
    expect(after).toContain("motion-safe:transition-opacity");
    expect(after).not.toMatch(/(?<!motion-safe:)transition-opacity/);
  });

  it("does not hold the page's preloaded LCP cover back for hydration", () => {
    const html = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="t" size={320} preload coverUrl={URL} />,
    );
    expect(html).toContain("opacity-100");
    const lazy = renderToStaticMarkup(<MeditationCover id={ID} tags={[]} title="t" size={320} coverUrl={URL} />);
    expect(lazy).toContain("opacity-0");
  });

  it("draws a cover up to 128px from its 256px thumbnail, as stored", () => {
    for (const size of [48, 56, 112, 128]) {
      const html = renderToStaticMarkup(
        <MeditationCover id={ID} tags={[]} title="t" size={size} coverUrl={URL} />,
      );
      expect(html, String(size)).toContain(`src="${THUMB}"`);
      // Never through the image optimizer, whose Hobby quota is small.
      expect(html).not.toContain("/_next/image");
      expect(html).not.toContain("srcSet");
    }
  });

  it("draws a card from 129px to 256px from its 512px middle size, never the thumbnail", () => {
    for (const size of [129, 160, 176, 240, 256]) {
      const html = renderToStaticMarkup(
        <MeditationCover id={ID} tags={[]} title="t" size={size} coverUrl={URL} />,
      );
      expect(html, String(size)).toContain(`src="${MIDDLE}"`);
      expect(html).not.toContain("/_next/image");
    }
  });

  it("draws a cover larger than 256px from the full image, as stored", () => {
    for (const size of [257, 320, 600]) {
      const html = renderToStaticMarkup(
        <MeditationCover id={ID} tags={[]} title="t" size={size} coverUrl={URL} />,
      );
      expect(html, String(size)).toContain(`src="${URL}"`);
      expect(html).not.toContain("/_next/image");
    }
  });

  it("is decorative by default and named by the title where it stands alone", () => {
    const decorative = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="Evening wind-down" size={160} coverUrl={URL} />,
    );
    expect(decorative).toContain('alt=""');
    expect(decorative).toContain("rounded-xl");

    const named = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="Evening wind-down" size={160} coverUrl={URL} decorative={false} />,
    );
    expect(named).toContain('alt="Evening wind-down"');
  });

  it("loads lazily unless it is the page's preloaded LCP image", () => {
    const lazy = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="t" size={320} coverUrl={URL} />,
    );
    expect(lazy).toContain('loading="lazy"');
    const preloaded = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="t" size={320} coverUrl={URL} preload />,
    );
    expect(preloaded).not.toContain('loading="lazy"');
    expect(preloaded).toContain('rel="preload"');
  });

  it("keeps the caller's classes, so a cropped cover still fills its box", () => {
    const html = renderToStaticMarkup(
      <MeditationCover id={ID} tags={[]} title="t" size={600} crop coverUrl={URL} className="size-full rounded-none" />,
    );
    expect(html).toContain("size-full");
    expect(html).toContain("rounded-none");
    expect(html).toContain("object-cover");
  });

  it("tries each larger size when a smaller one fails, then the designed cover", () => {
    // A cover stored before thumbnails existed has neither smaller size.
    const designed = <svg data-motif="moon" />;
    const view = (failures: number) =>
      renderToStaticMarkup(
        <CoverImageView src={URL} size={56} alt="" className="" failures={failures} loaded onLoad={() => {}} onError={() => {}} fallback={designed} />,
      );
    expect(view(0)).toContain(`src="${THUMB}"`);
    expect(view(1)).toContain(`src="${MIDDLE}"`);
    expect(view(2)).toContain(`src="${URL}"`);
    expect(view(3)).toBe('<svg data-motif="moon"></svg>');
  });

  it("falls back from the middle size to the full image for a cover stored before it existed", () => {
    const designed = <svg data-motif="moon" />;
    const view = (failures: number) =>
      renderToStaticMarkup(
        <CoverImageView src={URL} size={240} alt="" className="" failures={failures} loaded onLoad={() => {}} onError={() => {}} fallback={designed} />,
      );
    expect(view(0)).toContain(`src="${MIDDLE}"`);
    expect(view(1)).toContain(`src="${URL}"`);
    expect(view(2)).toBe('<svg data-motif="moon"></svg>');
  });

  it("falls back to the designed cover once a large photo fails", () => {
    const designed = <svg data-motif="moon" />;
    const view = (failures: number) =>
      renderToStaticMarkup(
        <CoverImageView src={URL} size={320} alt="" className="" failures={failures} loaded onLoad={() => {}} onError={() => {}} fallback={designed} />,
      );
    expect(view(0)).toMatch(/^<span [^>]*><img /);
    expect(view(1)).toBe('<svg data-motif="moon"></svg>');
  });

  it("starts from the smallest size that is sharp at 2x, then each larger one", () => {
    expect(coverSources(URL, 128)).toEqual([THUMB, MIDDLE, URL]);
    expect(coverSources(URL, 129)).toEqual([MIDDLE, URL]);
    expect(coverSources(URL, 256)).toEqual([MIDDLE, URL]);
    expect(coverSources(URL, 257)).toEqual([URL]);
  });
});
