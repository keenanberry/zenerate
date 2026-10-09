/**
 * Reads the hand-drawn mark (src/assets/brand/mark.svg) and composes the SVG
 * for each raster from it. The geometry lives only in that file; colours come
 * from DESIGN.md through the build script.
 */

export interface Vein {
  d: string;
  /** Set where a vein is heavier than the group's width: the midrib, the trunk. */
  width?: number;
}

export interface Mark {
  leaf: string;
  stem: string;
  veins: Vein[];
  veinWidth: number;
}

/** Pull the leaf, stem and vein paths out of the source SVG by id. */
export function readMark(svg: string): Mark {
  const pathById = (id: string) => {
    const match = svg.match(new RegExp(`<path[^>]*\\bid="${id}"[^>]*\\bd="([^"]+)"`));
    if (!match) throw new Error(`mark.svg has no <path id="${id}">`);
    return match[1];
  };
  const veinGroup = svg.match(/<g[^>]*\bid="veins"([^>]*)>([\s\S]*?)<\/g>/);
  if (!veinGroup) throw new Error('mark.svg has no <g id="veins">');
  const width = veinGroup[1].match(/stroke-width="([\d.]+)"/);
  if (!width) throw new Error("The veins group needs a stroke-width");

  return {
    leaf: pathById("leaf"),
    stem: pathById("stem"),
    veins: [...veinGroup[2].matchAll(/<path([^>]*)\/>/g)].map(([, attrs]) => {
      const d = attrs.match(/\bd="([^"]+)"/);
      if (!d) throw new Error("A vein <path> has no d attribute");
      const own = attrs.match(/stroke-width="([\d.]+)"/);
      return own ? { d: d[1], width: Number(own[1]) } : { d: d[1] };
    }),
    veinWidth: Number(width[1]),
  };
}

export interface MarkColours {
  leaf: string;
  /** Omit to leave the veins out, as every size under 64px does. */
  veins?: string;
}

/** The mark as SVG markup on its own 100-unit grid. */
export function markMarkup(mark: Mark, colours: MarkColours): string {
  const body = `<path fill="${colours.leaf}" d="${mark.leaf}"/><path fill="${colours.leaf}" d="${mark.stem}"/>`;
  if (!colours.veins) return body;
  const veins = mark.veins
    .map(({ d, width }) => (width ? `<path stroke-width="${width}" d="${d}"/>` : `<path d="${d}"/>`))
    .join("");
  return `${body}<g fill="none" stroke="${colours.veins}" stroke-width="${mark.veinWidth}" stroke-linecap="round">${veins}</g>`;
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
    `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${markMarkup(mark, colours)}</g>`,
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

/** Where the leaf's ink sits across its 100-unit box. */
const LEAF_LEFT = 12;
const LEAF_RIGHT = 88;

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
  const leafWidth = ((LEAF_RIGHT - LEAF_LEFT) / 100) * markHeight;
  const gap = 0.045 * o.width;

  const groupLeft = (o.width - (leafWidth + gap + textWidth)) / 2;
  const markX = groupLeft - (LEAF_LEFT / 100) * markHeight;
  const markY = (o.height - markHeight) / 2;
  const textX = groupLeft + leafWidth + gap;

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
