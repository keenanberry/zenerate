/**
 * A minimal ICO container. Every browser that still asks for /favicon.ico
 * accepts PNG-compressed entries (Windows Vista onward), so each size is the
 * PNG resvg already produced, stored as-is behind a directory.
 */

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

export interface IcoImage {
  size: number;
  png: Uint8Array;
}

export function encodeIco(images: IcoImage[]): Buffer {
  if (images.length === 0) throw new Error("An ICO needs at least one image");

  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
  const entries = images.map(({ size, png }) => {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`ICO entries are 1-256px, got ${size}`);
    }
    const entry = Buffer.alloc(ENTRY_BYTES);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size: none
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => Buffer.from(png))]);
}

/** The pixel sizes an ICO declares, in directory order. */
export function readIcoSizes(ico: Uint8Array): number[] {
  const buf = Buffer.from(ico);
  if (buf.length < HEADER_BYTES || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    throw new Error("Not an ICO file");
  }
  const count = buf.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const width = buf.readUInt8(HEADER_BYTES + i * ENTRY_BYTES);
    return width === 0 ? 256 : width;
  });
}
