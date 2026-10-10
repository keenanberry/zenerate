import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { iconSvg, markMarkup, ogSvg, pitchSvg, readMark, tierFor, type OgOptions } from "./mark";

const source = readFileSync(resolve(__dirname, "../../src/assets/brand/mark.svg"), "utf8");

const fixture = `<svg viewBox="0 0 100 100">
  <g id="petals" fill="none" stroke="#a995c9" stroke-width="5" data-bold-stroke-width="8.5" stroke-linecap="round">
    <path d="M1 1 L2 2 Z"/>
    <path d="M3 3 L4 4"/>
  </g>
  <path id="base" fill="none" stroke="#a995c9" stroke-width="5" d="M5 5 L6 6"/>
  <g id="dots" fill="#f2b8c6">
    <circle cx="50" cy="6" r="3.2"/>
    <circle cx="23" cy="17" r="2.7"/>
  </g>
</svg>`;

describe("readMark", () => {
  it("reads the petals, the base, each dot and both stroke weights", () => {
    expect(readMark(fixture)).toEqual({
      petals: ["M1 1 L2 2 Z", "M3 3 L4 4"],
      base: "M5 5 L6 6",
      dots: [
        { cx: 50, cy: 6, r: 3.2 },
        { cx: 23, cy: 17, r: 2.7 },
      ],
      strokeWidth: 5,
      boldStrokeWidth: 8.5,
    });
  });

  it("reads the real source file", () => {
    const mark = readMark(source);
    expect(mark.petals.length).toBeGreaterThan(4);
    expect(mark.petals[0]).toMatch(/^M.*Z$/);
    expect(mark.dots).toHaveLength(3);
    expect(mark.boldStrokeWidth).toBeGreaterThan(mark.strokeWidth);
  });

  it("names the missing part when the source is incomplete", () => {
    expect(() => readMark(fixture.replace('id="base"', 'id="stem"'))).toThrow(/id="base"/);
    expect(() => readMark(fixture.replace('id="dots"', 'id="veins"'))).toThrow(/dots/);
    expect(() => readMark(fixture.replace(' data-bold-stroke-width="8.5"', ""))).toThrow(/bold/);
  });
});

describe("tierFor", () => {
  it("is bold below 32px and ink from 32px up", () => {
    expect(tierFor(16)).toBe("bold");
    expect(tierFor(24)).toBe("bold");
    expect(tierFor(32)).toBe("ink");
    expect(tierFor(512)).toBe("ink");
  });
});

describe("markMarkup", () => {
  const mark = readMark(fixture);

  it("strokes the petals and the base in the ink, and fills the dots in it when no dot colour is given", () => {
    const svg = markMarkup(mark, { ink: "#111111" });
    expect(svg).toContain('stroke="#111111" stroke-width="5"');
    expect(svg).toContain('<path d="M5 5 L6 6"/>');
    expect(svg).toContain('<g fill="#111111"><circle cx="50" cy="6" r="3.2"/>');
  });

  it("fills the dots in their own colour", () => {
    expect(markMarkup(mark, { ink: "#111111", dots: "#222222" })).toContain('<g fill="#222222">');
  });

  it("in the bold tier keeps only the petals, heavier, dropped to centre their ink", () => {
    const svg = markMarkup(mark, { ink: "#111111", dots: "#222222" }, "bold");
    expect(svg).toContain('stroke-width="8.5"');
    expect(svg).toContain('transform="translate(0 5)"');
    expect(svg).not.toContain("M5 5 L6 6");
    expect(svg).not.toContain("<circle");
  });
});

describe("iconSvg", () => {
  const mark = readMark(fixture);

  it("draws an opaque ground only when one is given", () => {
    expect(iconSvg({ size: 180, scale: 0.7, colours: { ink: "#111111" } }, mark)).not.toContain("<rect");
    const opaque = iconSvg({ size: 180, scale: 0.7, background: "#1a1823", colours: { ink: "#111111" } }, mark);
    expect(opaque).toContain('<rect width="100" height="100" fill="#1a1823"/>');
    expect(opaque).toContain('width="180" height="180"');
  });

  it("scales the mark about the centre", () => {
    const svg = iconSvg({ size: 512, scale: 0.6, colours: { ink: "#111111" } }, mark);
    expect(svg).toContain('transform="translate(50 50) scale(0.6) translate(-50 -50)"');
  });

  it("picks the tier from the icon's size", () => {
    expect(iconSvg({ size: 16, scale: 1, colours: { ink: "#111111" } }, mark)).toContain('stroke-width="8.5"');
    expect(iconSvg({ size: 48, scale: 1, colours: { ink: "#111111" } }, mark)).toContain('stroke-width="5"');
  });
});

describe("og card", () => {
  const card: OgOptions = {
    width: 1200,
    height: 630,
    background: "#1a1823",
    text: "#e0ddef",
    colours: { ink: "#a995c9", dots: "#f2b8c6" },
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

    const groupLeft = markX + 0.035 * markHeight;
    const groupRight = textX + textWidth;
    expect(groupLeft).toBeCloseTo(1200 - groupRight, 0);
  });

  it("draws the full mark on the card, never the bold tier", () => {
    expect(ogSvg(card, mark, 700)).toContain('stroke-width="5"');
  });

  it("sets the pitch alone from x=0 for measuring", () => {
    const svg = pitchSvg(card);
    expect(svg).not.toContain("<rect");
    expect(svg).toContain('<tspan x="0"');
  });
});
