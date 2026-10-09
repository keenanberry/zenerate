import { describe, expect, it } from "vitest";
import { encodeIco, readIcoSizes } from "./ico";

const fakePng = (length: number, fill: number) => new Uint8Array(length).fill(fill);

describe("encodeIco", () => {
  it("writes an icon header, one directory entry per image, then the images in order", () => {
    const a = fakePng(10, 0xaa);
    const b = fakePng(20, 0xbb);
    const ico = encodeIco([
      { size: 16, png: a },
      { size: 32, png: b },
    ]);

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);

    const dataStart = 6 + 16 * 2;
    // First entry: 16x16, 32 bpp, 10 bytes at the start of the data.
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt8(7)).toBe(16);
    expect(ico.readUInt16LE(6 + 4)).toBe(1);
    expect(ico.readUInt16LE(6 + 6)).toBe(32);
    expect(ico.readUInt32LE(6 + 8)).toBe(10);
    expect(ico.readUInt32LE(6 + 12)).toBe(dataStart);
    // Second entry follows the first image.
    expect(ico.readUInt32LE(22 + 8)).toBe(20);
    expect(ico.readUInt32LE(22 + 12)).toBe(dataStart + 10);

    expect(ico.length).toBe(dataStart + 30);
    expect([...ico.subarray(dataStart, dataStart + 10)]).toEqual([...a]);
    expect([...ico.subarray(dataStart + 10)]).toEqual([...b]);
  });

  it("stores 256px as 0, as the format requires", () => {
    const ico = encodeIco([{ size: 256, png: fakePng(4, 1) }]);
    expect(ico.readUInt8(6)).toBe(0);
    expect(readIcoSizes(ico)).toEqual([256]);
  });

  it("refuses sizes the format cannot hold, and an empty icon", () => {
    expect(() => encodeIco([])).toThrow(/at least one/);
    expect(() => encodeIco([{ size: 512, png: fakePng(4, 1) }])).toThrow(/1-256/);
  });
});

describe("readIcoSizes", () => {
  it("round-trips the sizes encodeIco wrote", () => {
    const ico = encodeIco([16, 32, 48].map((size) => ({ size, png: fakePng(3, size) })));
    expect(readIcoSizes(ico)).toEqual([16, 32, 48]);
  });

  it("rejects a file that is not an icon", () => {
    expect(() => readIcoSizes(Buffer.from("\x89PNG\r\n\x1a\n"))).toThrow(/Not an ICO/);
  });
});
