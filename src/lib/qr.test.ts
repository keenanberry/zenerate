import { describe, expect, it } from "vitest";
import {
  alignmentPositions,
  encodeQr,
  formatBits,
  qrPath,
  reedSolomon,
  versionBits,
  versionFor,
} from "./qr";

describe("reedSolomon", () => {
  it("matches the standard's worked example (HELLO WORLD, 1-M)", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(reedSolomon(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe("formatBits", () => {
  it("matches the published level M format strings for all eight masks", () => {
    const expected = [
      "101010000010010",
      "101000100100101",
      "101111001111100",
      "101101101001011",
      "100010111111001",
      "100000011001110",
      "100111110010111",
      "100101010100000",
    ];
    expected.forEach((bits, mask) => {
      expect(formatBits(mask).toString(2).padStart(15, "0")).toBe(bits);
    });
  });
});

describe("versionBits", () => {
  it("matches the published version information strings", () => {
    expect(versionBits(7).toString(2).padStart(18, "0")).toBe("000111110010010100");
    expect(versionBits(8).toString(2).padStart(18, "0")).toBe("001000010110111100");
    expect(versionBits(10).toString(2).padStart(18, "0")).toBe("001010010011010011");
  });
});

describe("alignmentPositions", () => {
  it("matches the standard's table", () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(6)).toEqual([6, 34]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(10)).toEqual([6, 28, 50]);
  });
});

describe("versionFor", () => {
  it("picks the smallest version whose level M byte capacity fits", () => {
    // Byte-mode capacities at M: 14, 26, 42, 62, ... 213 at version 10.
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(42)).toBe(3);
    expect(versionFor(43)).toBe(4);
    expect(versionFor(213)).toBe(10);
    expect(() => versionFor(214)).toThrow(RangeError);
  });
});

describe("encodeQr", () => {
  it("sizes the symbol by version and draws the three finders and timing", () => {
    const matrix = encodeQr("https://www.zeneratestudio.com/");
    // 31 bytes: version 3, 29 modules.
    expect(matrix).toHaveLength(29);
    const finderRow = [true, true, true, true, true, true, true, false];
    expect(matrix[0].slice(0, 8)).toEqual(finderRow);
    expect(matrix[0].slice(21)).toEqual([...finderRow].reverse());
    expect(matrix[28].slice(0, 8)).toEqual(finderRow);
    // Timing pattern along row 6 between the finders.
    expect(matrix[6].slice(8, 21)).toEqual(
      Array.from({ length: 13 }, (_, i) => (8 + i) % 2 === 0),
    );
    // The dark module.
    expect(matrix[29 - 8][8]).toBe(true);
  });

  it("writes the chosen mask's format bits in both copies", () => {
    for (let mask = 0; mask < 8; mask++) {
      const m = encodeQr("zenerate", { mask });
      const bits = formatBits(mask);
      const bit = (i: number) => ((bits >>> i) & 1) === 1;
      const size = m.length;
      expect(m[0][8]).toBe(bit(0));
      expect(m[8][7]).toBe(bit(8));
      expect(m[8][size - 1]).toBe(bit(0));
      expect(m[size - 1][8]).toBe(bit(14));
    }
  });

  it("encodes the same text to the same matrix", () => {
    expect(encodeQr("https://example.com/")).toEqual(encodeQr("https://example.com/"));
  });
});

describe("qrPath", () => {
  it("draws one unit square per dark module, offset by the quiet zone", () => {
    expect(qrPath([[true, false], [false, true]], 4)).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");
  });
});
