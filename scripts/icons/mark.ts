/**
 * Reads the hand-drawn mark (src/assets/brand/mark.svg) and composes the SVG
 * for each raster from it. The geometry lives only in that file; colours come
 * from DESIGN.md through the build script.
 */

export interface Dot {
  cx: number;
  cy: number;
  r: number;
}

export interface Mark {
  /** The petal edges, as open strokes (the centre petal is closed). */
  petals: string[];
  /** The line under the flower. */
  base: string;
  /** The three dots above it. */
  dots: Dot[];
  /** Stroke width at 32px and up. */
  strokeWidth: number;
  /** Stroke width below 32px, where the base and dots are dropped. */
  boldStrokeWidth: number;
}

/** Pull the petals, base and dots out of the source SVG by id. */
export function readMark(svg: string): Mark {
  const group = (id: string) => {
    const match = svg.match(new RegExp(`<g[^>]*\\bid="${id}"([^>]*)>([\\s\\S]*?)<\\/g>`));
    if (!match) throw new Error(`mark.svg has no <g id="${id}">`);
    return { attrs: match[1], inner: match[2] };
  };
  const number = (attrs: string, name: string, where: string) => {
    const match = attrs.match(new RegExp(`\\b${name}="([\\d.]+)"`));
    if (!match) throw new Error(`${where} needs a ${name}`);
    return Number(match[1]);
  };

  const petals = group("petals");
  const base = svg.match(/<path[^>]*\bid="base"[^>]*\bd="([^"]+)"/);
  if (!base) throw new Error('mark.svg has no <path id="base">');
  const dots = group("dots");

  return {
    petals: [...petals.inner.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map(([, d]) => d),
    base: base[1],
    dots: [...dots.inner.matchAll(/<circle([^>]*)\/>/g)].map(([, attrs]) => ({
      cx: number(attrs, "cx", "A dot"),
      cy: number(attrs, "cy", "A dot"),
      r: number(attrs, "r", "A dot"),
    })),
    strokeWidth: number(petals.attrs, "stroke-width", "The petals group"),
    boldStrokeWidth: number(petals.attrs, "data-bold-stroke-width", "The petals group"),
  };
}

/** Below this the lines close up, so the mark is drawn in the bold tier. */
export const BOLD_BELOW_PX = 32;

export type Tier = "ink" | "bold";

export const tierFor = (size: number): Tier => (size < BOLD_BELOW_PX ? "bold" : "ink");

export interface MarkColours {
  ink: string;
  /** The dots' colour; omit to draw them in the ink. */
  dots?: string;
}

/**
 * The mark as SVG markup on its own 100-unit grid. The bold tier keeps only
 * the petals, heavier, and drops them 5 units so their ink is centred in the
 * box the way the full mark's is.
 */
export function markMarkup(mark: Mark, colours: MarkColours, tier: Tier = "ink"): string {
  const stroke = (width: number) => `fill="none" stroke="${colours.ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  const petals = mark.petals.map((d) => `<path d="${d}"/>`).join("");
  if (tier === "bold") {
    return `<g ${stroke(mark.boldStrokeWidth)} transform="translate(0 5)">${petals}</g>`;
  }
  const dots = mark.dots.map(({ cx, cy, r }) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("");
  return `<g ${stroke(mark.strokeWidth)}>${petals}<path d="${mark.base}"/></g><g fill="${colours.dots ?? colours.ink}">${dots}</g>`;
}

export interface IconOptions {
  size: number;
  /** The mark's 100-unit box as a fraction of the icon's width. */
  scale: number;
  /** Opaque ground behind the mark. Omit for a transparent icon. */
  background?: string;
  colours: MarkColours;
}

/** A square icon: the mark centred on an optional full-bleed ground. */
export function iconSvg({ size, scale, background, colours }: IconOptions, mark: Mark): string {
  const ground = background ? `<rect width="100" height="100" fill="${background}"/>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">`,
    ground,
    `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${markMarkup(mark, colours, tierFor(size))}</g>`,
    `</svg>`,
  ].join("");
}

export interface OgOptions {
  width: number;
  height: number;
  background: string;
  text: string;
  colours: Required<MarkColours>;
  /** The locked pitch, already broken into display lines. */
  lines: string[];
  fontFamily: string;
  fontSize: number;
}

/** Where the mark's ink sits across its 100-unit box: the outer petal tips plus half a stroke. */
const MARK_LEFT = 3.5;
const MARK_RIGHT = 96.5;

/**
 * The pitch alone, set from x=0 on a transparent canvas the card's size.
 * The build renders this to measure the widest line's ink, then passes that
 * width to ogSvg, so the layout follows the font rather than a guess at it.
 */
export function pitchSvg(o: OgOptions): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">`,
    pitchText(o, 0),
    `</svg>`,
  ].join("");
}

/**
 * The share card: the mark beside the pitch in Lora, the pair centred as one
 * group. Both stay well inside the edges, so the crops and letterboxing
 * iMessage, Slack, X and Discord apply leave them whole.
 */
export function ogSvg(o: OgOptions, mark: Mark, textWidth: number): string {
  const markHeight = 0.46 * o.height;
  const markScale = markHeight / 100;
  const markWidth = ((MARK_RIGHT - MARK_LEFT) / 100) * markHeight;
  const gap = 0.045 * o.width;

  const groupLeft = (o.width - (markWidth + gap + textWidth)) / 2;
  const markX = groupLeft - (MARK_LEFT / 100) * markHeight;
  const markY = (o.height - markHeight) / 2;
  const textX = groupLeft + markWidth + gap;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">`,
    `<rect width="${o.width}" height="${o.height}" fill="${o.background}"/>`,
    `<g transform="translate(${round(markX)} ${round(markY)}) scale(${round(markScale)})">${markMarkup(mark, o.colours)}</g>`,
    pitchText(o, textX),
    `</svg>`,
  ].join("");
}

function pitchText(o: OgOptions, x: number): string {
  const lineHeight = o.fontSize * 1.2;
  // Centre the block on the cap height, not the em box, so it sits level
  // with the mark rather than visibly high.
  const capHeight = o.fontSize * 0.7;
  const blockHeight = lineHeight * (o.lines.length - 1) + capHeight;
  const firstBaseline = (o.height - blockHeight) / 2 + capHeight;
  const tspans = o.lines
    .map((line, i) => `<tspan x="${round(x)}" y="${round(firstBaseline + i * lineHeight)}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text font-family="${o.fontFamily}" font-size="${o.fontSize}" font-weight="500" fill="${o.text}">${tspans}</text>`;
}

const round = (n: number) => Number(n.toFixed(2));

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
