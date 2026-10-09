/**
 * Render every icon and the OG image from the hand-drawn mark.
 *
 *   npx tsx scripts/build-icons.ts           # write the files
 *   npx tsx scripts/build-icons.ts --check   # verify the committed files match
 *
 * The source is src/assets/brand/mark.svg; colours are the Nocturne tokens
 * read from DESIGN.md's frontmatter; the OG text is set in Lora from the TTF
 * in src/assets/brand/fonts. System fonts are never loaded, so the output is
 * byte-for-byte the same on any machine with the locked @resvg/resvg-js.
 *
 * --check renders everything in memory, prints each file's dimensions and
 * fails if a committed file differs from what the source produces: run it
 * after editing the mark or the tokens to confirm the exports were rebuilt.
 */
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { oklchToHex, parseColorTokens } from "./icons/color";
import { encodeIco, readIcoSizes } from "./icons/ico";
import { iconSvg, ogSvg, pitchSvg, readMark, type IconOptions } from "./icons/mark";
import { artworkReach, hexToRgb, inkColumns, isOpaque, pngSize } from "./icons/raster";

const root = resolve(__dirname, "..");
const at = (path: string) => resolve(root, path);

const tokens = parseColorTokens(readFileSync(at("DESIGN.md"), "utf8"));
const colour = (name: string) => {
  if (!tokens[name]) throw new Error(`DESIGN.md has no colour token "${name}"`);
  return oklchToHex(tokens[name]);
};
const midnight = colour("midnight");
const amethystGlow = colour("amethyst-glow");
const roseQuartz = colour("rose-quartz");
const moonlit = colour("moonlit");

const mark = readMark(readFileSync(at("src/assets/brand/mark.svg"), "utf8"));
const loraMedium = at("src/assets/brand/fonts/Lora-Medium.ttf");

// The pitch is locked in PRODUCT.md; change it there, on the landing page and
// in the meta description too, or not at all.
const PITCH_LINES = ["Meditations composed", "for you, not picked", "from a catalogue."];

/** Below this the veins blur into the leaf, so small sizes are the silhouette. */
const VEINS_FROM_PX = 64;

const markColours = (size: number) => ({
  leaf: amethystGlow,
  veins: size >= VEINS_FROM_PX ? roseQuartz : undefined,
});

function render(svg: string, options: ResvgRenderOptions = {}) {
  const rendered = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: [loraMedium], defaultFontFamily: "Lora" },
    ...options,
  }).render();
  return { png: rendered.asPng(), pixels: rendered.pixels };
}

function icon(options: Omit<IconOptions, "colours">) {
  return render(iconSvg({ ...options, colours: markColours(options.size) }, mark));
}

interface Output {
  path: string;
  bytes: Buffer;
  describe: string;
}

function build(): Output[] {
  const outputs: Output[] = [];

  // favicon.ico: the silhouette, transparent, at the three sizes browsers ask
  // for. Full-size in its box: at 16px every pixel of leaf counts.
  const faviconSizes = [16, 32, 48];
  const favicon = encodeIco(
    faviconSizes.map((size) => ({ size, png: icon({ size, scale: 1 }).png })),
  );
  outputs.push({ path: "src/app/favicon.ico", bytes: favicon, describe: `ICO ${readIcoSizes(favicon).join("/")}px` });

  // "any" icons: full-bleed Midnight, so they hold up as lock-screen artwork
  // (task 25) and on whatever ground an install surface puts them.
  for (const size of [192, 512]) {
    outputs.push(png(`public/icon-${size}.png`, icon({ size, scale: 0.72, background: midnight })));
  }

  // Maskable: the launcher crops to a circle, squircle or square, and only
  // the central circle of radius 40% is guaranteed to survive.
  const maskable = icon({ size: 512, scale: 0.68, background: midnight });
  const reach = artworkReach(maskable.pixels, 512, hexToRgb(midnight));
  if (reach > 0.4) throw new Error(`Maskable artwork reaches ${reach.toFixed(3)} of the width; the safe zone is 0.4`);
  outputs.push(png("public/icon-maskable-512.png", maskable, `artwork reach ${reach.toFixed(3)} (safe zone 0.4)`));

  // iOS composites a transparent apple-touch-icon onto black, so it is opaque
  // Midnight. iOS rounds the corners itself.
  const apple = icon({ size: 180, scale: 0.72, background: midnight });
  if (!isOpaque(apple.pixels)) throw new Error("apple-touch-icon.png must be fully opaque");
  outputs.push(png("public/apple-touch-icon.png", apple, "opaque"));

  const card = {
    width: 1200,
    height: 630,
    background: midnight,
    text: moonlit,
    colours: { leaf: amethystGlow, veins: roseQuartz },
    lines: PITCH_LINES,
    fontFamily: "Lora",
    fontSize: 66,
  };
  const ink = inkColumns(render(pitchSvg(card)).pixels, card.width);
  if (!ink) throw new Error("The pitch rendered no ink: is Lora-Medium.ttf in src/assets/brand/fonts?");
  // Measured from the text origin, so the glyphs' side bearing is counted.
  const og = render(ogSvg(card, mark, ink.right));
  if (!isOpaque(og.pixels)) throw new Error("og-image.png must be fully opaque");
  outputs.push(png("public/og-image.png", og));

  return outputs;
}

function png(path: string, { png }: { png: Buffer }, note?: string): Output {
  const { width, height } = pngSize(png);
  return { path, bytes: png, describe: `PNG ${width}x${height}${note ? `, ${note}` : ""}` };
}

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

const check = process.argv.includes("--check");
let stale = 0;
for (const { path, bytes, describe } of build()) {
  const file = at(path);
  if (check) {
    const committed = existsSync(file) ? readFileSync(file) : null;
    const matches = committed?.equals(bytes) ?? false;
    if (!matches) stale++;
    console.log(`${matches ? "ok   " : "STALE"} ${path.padEnd(30)} ${describe.padEnd(44)} sha256 ${sha(bytes)}`);
  } else {
    writeFileSync(file, bytes);
    console.log(`wrote ${path.padEnd(30)} ${describe.padEnd(44)} sha256 ${sha(bytes)}`);
  }
}
if (stale) {
  console.error(`\n${stale} file(s) differ from the source. Run: npx tsx scripts/build-icons.ts`);
  process.exit(1);
}
