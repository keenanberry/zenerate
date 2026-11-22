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

  it("has a photo for each of the six categories the images were made for", () => {
    for (const slug of ["sleep", "stress-relief", "focus", "morning", "kindness", "breath-and-body"]) {
      expect(html).toContain(`src="/discover/categories/${slug}.webp"`);
    }
  });

  it("loads only the first row eagerly", () => {
    const loading = [...html.matchAll(/<img [^>]*loading="(\w+)"/g)].map((m) => m[1]);
    expect(loading).toEqual(["eager", "eager", "eager", "eager", "lazy", "lazy"]);
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
    expect(tile).toContain("bg-night");
  });

  it("falls back to the designed tile for a category without a photo", () => {
    const tile = renderToStaticMarkup(
      <CategoryTile category={{ slug: "patience", label: "Patience", tags: ["grounding"] }} />,
    );
    expect(categoryImagePath("patience")).toBeNull();
    expect(tile).toContain('href="/discover?category=patience"');
    expect(tile).toContain(">Patience</span>");
    expect(tile).not.toContain("<img");
    expect(tile).toContain("var(--cover-field-");
    expect(tile).toContain("<svg");
  });
});
