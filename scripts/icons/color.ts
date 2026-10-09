/**
 * Colour helpers for the icon build. resvg does not parse `oklch()`, so the
 * Nocturne tokens are converted to sRGB hex before they reach an SVG.
 */

/**
 * Read the named colour tokens from DESIGN.md's YAML frontmatter, so the
 * rasters follow the design record rather than a second copy of its values.
 * Only `name: "oklch(...)"` lines inside the frontmatter's `colors:` block
 * are read.
 */
export function parseColorTokens(markdown: string): Record<string, string> {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) throw new Error("DESIGN.md has no YAML frontmatter");

  const tokens: Record<string, string> = {};
  let inColors = false;
  for (const line of frontmatter[1].split("\n")) {
    if (/^\S/.test(line)) {
      inColors = line.startsWith("colors:");
      continue;
    }
    if (!inColors) continue;
    const token = line.match(/^\s+([a-z0-9-]+):\s*"(oklch\([^"]+\))"/);
    if (token) tokens[token[1]] = token[2];
  }
  return tokens;
}

/** Convert a CSS `oklch(L C H)` string (L as 0–1, no alpha) to `#rrggbb`. */
export function oklchToHex(value: string): string {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`Not an oklch() colour: ${value}`);
  const [L, C, H] = match.slice(1).map(Number);

  const hue = (H * Math.PI) / 180;
  const a = C * Math.cos(hue);
  const b = C * Math.sin(hue);

  // OKLab to linear sRGB (Björn Ottosson's reference matrices).
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return (
    "#" +
    linear
      .map((channel) => {
        const c = Math.min(1, Math.max(0, channel));
        const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
