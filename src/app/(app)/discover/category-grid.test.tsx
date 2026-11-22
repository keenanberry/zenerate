import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DISCOVER_CATEGORIES } from "@/lib/meditation/tags";
import { CATEGORY_IMAGES, CategoryGrid, CategoryTile, categoryImagePath } from "./category-grid";

const escape = (s: string) => s.replace(/&/g, "&amp;");

describe("CategoryGrid", () => {
  const html = renderToStaticMarkup(<CategoryGrid />);

  it("renders every category's label, and its photo where it has one", () => {
    for (const category of DISCOVER_CATEGORIES) {
      expect(html).toContain(`>${escape(category.label)}</span>`);
      const src = categoryImagePath(category.slug);
      if (src) expect(html).toContain(`src="${src}"`);
    }
  });

  it("has a photo for every category", () => {
    for (const { slug } of DISCOVER_CATEGORIES) {
      expect(html).toContain(`src="/discover/categories/${slug}.webp"`);
    }
  });

  it("loads only the first two photos eagerly", () => {
    const loading = [...html.matchAll(/<img [^>]*loading="(\w+)"/g)].map((m) => m[1]);
    expect(loading).toEqual(["eager", "eager", ...Array(DISCOVER_CATEGORIES.length - 2).fill("lazy")]);
  });

  it("names each tile by its label alone", () => {
    expect([...html.matchAll(/<img [^>]*alt="([^"]*)"/g)].every((m) => m[1] === "")).toBe(true);
  });

  it("serves the photos as stored, not through Image Optimization", () => {
    expect(html).not.toContain("/_next/image");
  });
});

describe("CATEGORY_IMAGES", () => {
  it("lists only real categories, each with a file in public/", () => {
    const slugs = new Set(DISCOVER_CATEGORIES.map((c) => c.slug));
    for (const slug of Object.keys(CATEGORY_IMAGES)) {
      expect(slugs.has(slug)).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", `discover/categories/${slug}.webp`))).toBe(true);
    }
  });
});

describe("CategoryTile", () => {
  it("draws a photo tile with a light label over the scrim", () => {
    const tile = renderToStaticMarkup(
      <CategoryTile category={{ slug: "sleep", label: "Sleep", tags: ["sleep"] }} />,
    );
    expect(tile).toContain('href="/discover?category=sleep"');
    expect(tile).toContain('src="/discover/categories/sleep.webp"');
    expect(tile).toContain('width="640"');
    expect(tile).toContain('height="640"');
    expect(tile).toMatch(/class="dark [^"]*text-foreground/);
  });

  it("lays the night scrim, sized in rem, between the photo and the label", () => {
    const tile = renderToStaticMarkup(
      <CategoryTile category={{ slug: "stress-relief", label: "Stress relief", tags: ["stress-relief"] }} />,
    );
    const scrim = tile.match(/<div aria-hidden="true" data-scrim="true" class="([^"]*)"/);
    expect(scrim).not.toBeNull();
    expect(scrim![1]).toContain("bg-night");
    // Sized in rem so the alpha behind the label does not change with the
    // tile's width (DESIGN.md, Category tiles).
    expect(scrim![1]).toContain(
      "[mask-image:radial-gradient(ellipse_15rem_5.5rem_at_0_0,rgb(0_0_0/0.8),rgb(0_0_0/0.7)_75%,transparent)]",
    );
    expect(tile.indexOf("<img")).toBeLessThan(tile.indexOf("data-scrim"));
    expect(tile.indexOf("data-scrim")).toBeLessThan(tile.indexOf(">Stress relief</span>"));
  });

  it("falls back to the designed tile for a category without a photo", () => {
    const tile = renderToStaticMarkup(
      <CategoryTile category={{ slug: "patience", label: "Patience", tags: ["grounding"] }} />,
    );
    expect(categoryImagePath("patience")).toBeNull();
    expect(categoryImagePath("constructor")).toBeNull();
    expect(tile).toContain('href="/discover?category=patience"');
    expect(tile).toContain(">Patience</span>");
    expect(tile).not.toContain("<img");
    expect(tile).not.toContain("data-scrim");
    expect(tile).toContain("var(--cover-field-");
    expect(tile).toContain("<svg");
  });
});
