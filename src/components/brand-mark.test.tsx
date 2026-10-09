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
    expect(html).not.toMatch(/fill="#/);
  });

  it("is decorative unless given a title", () => {
    expect(renderToStaticMarkup(<BrandMark />)).toContain('aria-hidden="true"');

    const named = renderToStaticMarkup(<BrandMark title="Zenerate" />);
    expect(named).toContain('role="img"');
    expect(named).toContain("<title>Zenerate</title>");
    expect(named).not.toContain("aria-hidden");
  });

  it("cuts the veins out with a mask whose id is unique per instance", () => {
    const html = renderToStaticMarkup(
      <>
        <BrandMark />
        <BrandMark />
      </>,
    );
    const ids = [...html.matchAll(/<mask id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`mask="url(#${id})"`);
  });

  it("drops the veins at small sizes when asked", () => {
    const html = renderToStaticMarkup(<BrandMark veins={false} />);
    expect(html).not.toContain("<mask");
    expect(html).not.toContain("mask=");
  });
});
