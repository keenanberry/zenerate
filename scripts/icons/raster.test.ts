import { describe, expect, it } from "vitest";
import { artworkReach, hexToRgb, inkColumns, isOpaque, pngSize } from "./raster";

/** A size x size RGBA image of one colour, with optional pixels painted over it. */
function image(size: number, ground: number[], painted: [number, number, number[]][] = []) {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set(ground, i * 4);
  for (const [x, y, colour] of painted) rgba.set(colour, (y * size + x) * 4);
  return rgba;
}

describe("pngSize", () => {
  it("reads width and height from the IHDR chunk", () => {
    const header = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(header, 0);
    header.writeUInt32BE(13, 8);
    header.write("IHDR", 12, "ascii");
    header.writeUInt32BE(1200, 16);
    header.writeUInt32BE(630, 20);
    expect(pngSize(header)).toEqual({ width: 1200, height: 630 });
  });

  it("rejects a file that is not a PNG", () => {
    expect(() => pngSize(Buffer.alloc(24))).toThrow(/Not a PNG/);
  });
});

describe("isOpaque", () => {
  it("is true only when every alpha byte is 255", () => {
    expect(isOpaque(image(4, [26, 24, 35, 255]))).toBe(true);
    expect(isOpaque(image(4, [26, 24, 35, 255], [[3, 3, [0, 0, 0, 254]]]))).toBe(false);
  });
});

describe("artworkReach", () => {
  const ground = [26, 24, 35, 255];

  it("is zero for an empty ground", () => {
    expect(artworkReach(image(10, ground), 10, [26, 24, 35])).toBe(0);
  });

  it("measures to the far corner of the outermost artwork pixel", () => {
    // A pixel in the top-left corner reaches the corner itself: half the diagonal.
    const corner = image(10, ground, [[0, 0, [255, 255, 255, 255]]]);
    expect(artworkReach(corner, 10, [26, 24, 35])).toBeCloseTo(Math.SQRT2 / 2);

    // A pixel just right of centre reaches one pixel out, horizontally and vertically.
    const centre = image(10, ground, [[5, 5, [255, 255, 255, 255]]]);
    expect(artworkReach(centre, 10, [26, 24, 35])).toBeCloseTo(Math.hypot(1, 1) / 10);
  });
});

describe("inkColumns", () => {
  it("finds the leftmost and one-past-rightmost columns with any alpha", () => {
    const rgba = image(8, [0, 0, 0, 0], [
      [2, 1, [255, 255, 255, 40]],
      [5, 6, [255, 255, 255, 255]],
    ]);
    expect(inkColumns(rgba, 8)).toEqual({ left: 2, right: 6 });
  });

  it("is null for a fully transparent image", () => {
    expect(inkColumns(image(4, [0, 0, 0, 0]), 4)).toBeNull();
  });
});

describe("hexToRgb", () => {
  it("parses #rrggbb in either case", () => {
    expect(hexToRgb("#1A1823")).toEqual([26, 24, 35]);
  });

  it("rejects shorthand and named colours", () => {
    expect(() => hexToRgb("#fff")).toThrow();
    expect(() => hexToRgb("white")).toThrow();
  });
});
