/**
 * Checks on rendered pixels, so the build fails instead of shipping an icon
 * that breaks a platform rule: iOS composites transparency onto black, and
 * Android crops a maskable icon to whatever shape the launcher uses.
 */

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const buf = Buffer.from(png);
  const signature = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== signature || buf.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Not a PNG file");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** True when every pixel of an RGBA buffer is fully opaque. */
export function isOpaque(rgba: Uint8Array): boolean {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) return false;
  }
  return true;
}

/**
 * How far the artwork reaches from the centre of a square RGBA image, as a
 * fraction of its width: the largest distance from the centre to any pixel
 * that differs from the background colour. A maskable icon's safe zone is a
 * circle of radius 0.4, so its artwork must come out at 0.4 or less.
 */
export function artworkReach(rgba: Uint8Array, size: number, background: [number, number, number]): number {
  const centre = size / 2;
  let reach = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const differs =
        rgba[i] !== background[0] || rgba[i + 1] !== background[1] || rgba[i + 2] !== background[2];
      if (!differs) continue;
      // Measure to the pixel's far corner, so a pixel that only touches the
      // boundary still counts as reaching it.
      const dx = Math.max(Math.abs(x - centre), Math.abs(x + 1 - centre));
      const dy = Math.max(Math.abs(y - centre), Math.abs(y + 1 - centre));
      reach = Math.max(reach, Math.hypot(dx, dy) / size);
    }
  }
  return reach;
}

/**
 * The columns an RGBA image has any ink in (alpha above zero), or null for
 * an empty image. Used to measure rendered text.
 */
export function inkColumns(rgba: Uint8Array, width: number): { left: number; right: number } | null {
  let left = Infinity;
  let right = -Infinity;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] === 0) continue;
    const x = ((i - 3) / 4) % width;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return Number.isFinite(left) ? { left, right: right + 1 } : null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}
