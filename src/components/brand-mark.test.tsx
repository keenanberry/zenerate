import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readMark } from "../../scripts/icons/mark";
import { BRAND_MARK_GEOMETRY, BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("carries exactly the geometry of the source SVG", () => {
    const source = readMark(readFileSync(resolve(__dirname, "../assets/brand/mark.svg"), "utf8"));
    expect(BRAND_MARK_GEOMETRY).toEqual(source);
  });

  it("paints in currentColor so it takes the surrounding text token", () => {
    const html = renderToStaticMarkup(<BrandMark />);
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/(fill|stroke)="#/);
  });

  it("is decorative unless given a title", () => {
    expect(renderToStaticMarkup(<BrandMark />)).toContain('aria-hidden="true"');

    const named = renderToStaticMarkup(<BrandMark title="Zenerate" />);
    expect(named).toContain('role="img"');
    expect(named).toContain("<title>Zenerate</title>");
    expect(named).not.toContain("aria-hidden");
  });

  it("draws the base and the three dots at the ink weight by default", () => {
    const html = renderToStaticMarkup(<BrandMark />);
    expect(html).toContain(`stroke-width="${BRAND_MARK_GEOMETRY.strokeWidth}"`);
    expect(html).toContain(`d="${BRAND_MARK_GEOMETRY.base}"`);
    expect(html.match(/<circle /g)).toHaveLength(3);
  });

  it("in the bold tier keeps only the petals, heavier, dropped to centre their ink", () => {
    const html = renderToStaticMarkup(<BrandMark bold />);
    expect(html).toContain(`stroke-width="${BRAND_MARK_GEOMETRY.boldStrokeWidth}"`);
    expect(html).toContain('transform="translate(0 5)"');
    expect(html).not.toContain(BRAND_MARK_GEOMETRY.base);
    expect(html).not.toContain("<circle");
  });
});
