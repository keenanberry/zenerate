import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { iconSvg, markMarkup, ogSvg, pitchSvg, readMark, type OgOptions } from "./mark";

const source = readFileSync(resolve(__dirname, "../../src/assets/brand/mark.svg"), "utf8");

const fixture = `<svg viewBox="0 0 100 100">
  <path id="leaf" fill="#a995c9" d="M1 1 L2 2 Z"/>
  <path id="stem" fill="#a995c9" d="M3 3 L4 4 Z"/>
  <g id="veins" fill="none" stroke="#f2b8c6" stroke-width="1.5" stroke-linecap="round">
    <path stroke-width="3" d="M5 5 L6 6"/>
    <path d="M7 7 L8 8"/>
  </g>
</svg>`;

describe("readMark", () => {
  it("reads the leaf, the stem and each vein with its own width where it has one", () => {
    expect(readMark(fixture)).toEqual({
      leaf: "M1 1 L2 2 Z",
      stem: "M3 3 L4 4 Z",
      veins: [{ d: "M5 5 L6 6", width: 3 }, { d: "M7 7 L8 8" }],
      veinWidth: 1.5,
    });
  });

  it("reads the real source file", () => {
    const mark = readMark(source);
    expect(mark.leaf).toMatch(/^M.*Z$/);
    expect(mark.veins.length).toBeGreaterThan(0);
  });

  it("names the missing part when the source is incomplete", () => {
    expect(() => readMark(fixture.replace('id="stem"', 'id="trunk"'))).toThrow(/id="stem"/);
    expect(() => readMark(fixture.replace('id="veins"', 'id="branches"'))).toThrow(/veins/);
  });
});

describe("markMarkup", () => {
  const mark = readMark(fixture);

  it("leaves the veins out when no vein colour is given", () => {
    const svg = markMarkup(mark, { leaf: "#111111" });
    expect(svg).not.toContain("stroke");
    expect(svg.match(/fill="#111111"/g)).toHaveLength(2);
  });

  it("strokes the veins in their colour, keeping a vein's own width", () => {
    const svg = markMarkup(mark, { leaf: "#111111", veins: "#222222" });
    expect(svg).toContain('stroke="#222222" stroke-width="1.5"');
    expect(svg).toContain('<path stroke-width="3" d="M5 5 L6 6"/>');
    expect(svg).toContain('<path d="M7 7 L8 8"/>');
  });
});

describe("iconSvg", () => {
  const mark = readMark(fixture);

  it("draws an opaque ground only when one is given", () => {
    expect(iconSvg({ size: 180, scale: 0.7, colours: { leaf: "#111111" } }, mark)).not.toContain("<rect");
    const opaque = iconSvg({ size: 180, scale: 0.7, background: "#1a1823", colours: { leaf: "#111111" } }, mark);
    expect(opaque).toContain('<rect width="100" height="100" fill="#1a1823"/>');
    expect(opaque).toContain('width="180" height="180"');
  });

  it("scales the mark about the centre", () => {
    const svg = iconSvg({ size: 512, scale: 0.6, colours: { leaf: "#111111" } }, mark);
    expect(svg).toContain('transform="translate(50 50) scale(0.6) translate(-50 -50)"');
  });
});

describe("og card", () => {
  const card: OgOptions = {
    width: 1200,
    height: 630,
    background: "#1a1823",
    text: "#e0ddef",
    colours: { leaf: "#a995c9", veins: "#f2b8c6" },
    lines: ["Meditations composed", "for you & not <picked>"],
    fontFamily: "Lora",
    fontSize: 66,
  };
  const mark = readMark(fixture);

  it("sets each line as its own tspan, escaped", () => {
    const svg = ogSvg(card, mark, 700);
    expect(svg.match(/<tspan /g)).toHaveLength(2);
    expect(svg).toContain("for you &amp; not &lt;picked&gt;");
  });

  it("centres the mark and the measured text as one group", () => {
    const textWidth = 700;
    const svg = ogSvg(card, mark, textWidth);
    const markHeight = 0.46 * 630;
    const markX = Number(svg.match(/<g transform="translate\(([\d.-]+) /)![1]);
    const textX = Number(svg.match(/<tspan x="([\d.]+)"/)![1]);

    const groupLeft = markX + 0.12 * markHeight;
    const groupRight = textX + textWidth;
    expect(groupLeft).toBeCloseTo(1200 - groupRight, 0);
  });

  it("sets the pitch alone from x=0 for measuring", () => {
    const svg = pitchSvg(card);
    expect(svg).not.toContain("<rect");
    expect(svg).toContain('<tspan x="0"');
  });
});
