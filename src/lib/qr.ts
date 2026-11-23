/**
 * A small QR code encoder: byte mode, error correction level M, versions 1
 * to 10 (up to 213 bytes, far more than a URL here needs). It exists so the
 * install prompt can show a desktop visitor a code that opens the site on
 * their phone without a QR dependency. It follows ISO/IEC 18004 and the
 * structure of Project Nayuki's reference encoder; `qr.test.ts` checks it
 * against the standard's published vectors.
 *
 * The result is a square of booleans, `true` for a dark module, without the
 * quiet zone: the renderer adds that.
 */

const MAX_VERSION = 10;

/** Error correction codewords per block, level M, indexed by version. */
const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** Number of error correction blocks, level M, indexed by version. */
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Level M's two format bits (L 01, M 00, Q 11, H 10). */
const FORMAT_BITS_M = 0;

export type QrMatrix = boolean[][];

/** Multiplies two elements of GF(2^8) modulo the QR polynomial 0x11D. */
function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** The Reed-Solomon generator polynomial of `degree`, highest term dropped. */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

/** The error correction codewords for `data`, `degree` of them. */
export function reedSolomon(data: readonly number[], degree: number): number[] {
  const divisor = rsDivisor(degree);
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

/** The 15 format bits for level M and `mask`, BCH-coded and XOR-masked. */
export function formatBits(mask: number): number {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** The 18 version bits (versions 7 and up), BCH-coded. */
export function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

/** Modules available for data and error correction in `version`. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_PER_BLOCK_M[version] * BLOCKS_M[version]
  );
}

/** Centres of the alignment patterns along one axis. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = version * 4 + 17 - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The smallest version that holds `byteLength` bytes at level M. */
export function versionFor(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= dataCodewords(version) * 8) return version;
  }
  throw new RangeError(`Too long for a version ${MAX_VERSION} QR code: ${byteLength} bytes`);
}

/** Mode, count, data, terminator and padding, as codewords. */
function encodeData(bytes: Uint8Array, version: number): number[] {
  const capacityBits = dataCodewords(version) * 8;
  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4); // byte mode
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) append(byte, 8);
  append(0, Math.min(4, capacityBits - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) append(pad, 8);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  return codewords;
}

/** Splits data into blocks, adds each block's error correction, interleaves. */
function addEccAndInterleave(data: number[], version: number): number[] {
  const numBlocks = BLOCKS_M[version];
  const blockEcc = ECC_PER_BLOCK_M[version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const length = shortBlockLen - blockEcc + (i < numShortBlocks ? 0 : 1);
    const block = data.slice(k, k + length);
    k += length;
    const ecc = reedSolomon(block, blockEcc);
    if (i < numShortBlocks) block.push(0); // a placeholder, skipped below
    blocks.push(block.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEcc || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

class Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  drawFunctionPatterns() {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((x, i) => {
      positions.forEach((y, j) => {
        // Not over the three finder corners.
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        this.drawAlignment(x, y);
      });
    });

    this.drawFormat(0); // reserves the area; redrawn once the mask is chosen
    this.drawVersion();
  }

  /** A finder pattern centred at (x, y), with its light separator. */
  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunction(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFormat(mask: number) {
    const bits = formatBits(mask);
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    const { size } = this;
    // First copy, around the top-left finder.
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(i));
    this.setFunction(8, 7, bit(6));
    this.setFunction(8, 8, bit(7));
    this.setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(i));
    // Second copy, split between the other two finders.
    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, bit(i));
    this.setFunction(8, size - 8, true); // the dark module
  }

  private drawVersion() {
    if (this.version < 7) return;
    const bits = versionBits(this.version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  /** Places codewords in the two-column zigzag, skipping function modules. */
  drawCodewords(codewords: number[]) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip the vertical timing pattern
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  /** XORs `mask` over every data module; applying it twice undoes it. */
  applyMask(mask: number) {
    const test = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.isFunction[y][x] && test(x, y)) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** The standard's penalty score (rules N1 to N4); lower reads better. */
  penalty(): number {
    const { size, modules } = this;
    let score = 0;
    const line = (get: (i: number) => boolean) => {
      // N1: runs of five or more same-coloured modules.
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && get(i) === get(i - 1)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // N3: a finder-like 1:1:3:1:1 with four light modules on one side
      // (beyond the symbol counts as light).
      const at = (i: number) => (i >= 0 && i < size ? get(i) : false);
      for (let i = -4; i < size; i++) {
        const core =
          at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6);
        if (!core) continue;
        const lightBefore = [1, 2, 3, 4].every((d) => !at(i - d));
        const lightAfter = [7, 8, 9, 10].every((d) => !at(i + d));
        if (lightBefore || lightAfter) score += 40;
      }
    };
    for (let y = 0; y < size; y++) line((x) => modules[y][x]);
    for (let x = 0; x < size; x++) line((y) => modules[y][x]);

    // N2: 2×2 blocks of one colour.
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
          score += 3;
        }
      }
    }

    // N4: how far the dark share strays from half, in 5% steps.
    let dark = 0;
    for (const row of modules) for (const m of row) if (m) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += Math.max(0, k) * 10;
    return score;
  }
}

/**
 * Encodes `text` (as UTF-8) into a QR code at level M. `mask` forces one of
 * the eight masks; by default the one with the lowest penalty is chosen.
 */
export function encodeQr(text: string, { mask }: { mask?: number } = {}): QrMatrix {
  if (mask !== undefined && !(Number.isInteger(mask) && mask >= 0 && mask <= 7)) {
    throw new RangeError(`A QR mask is 0 to 7, not ${mask}`);
  }
  const bytes = new TextEncoder().encode(text);
  const version = versionFor(bytes.length);
  const grid = new Grid(version);
  grid.drawFunctionPatterns();
  grid.drawCodewords(addEccAndInterleave(encodeData(bytes, version), version));

  let chosen = mask;
  if (chosen === undefined) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      grid.applyMask(m);
      grid.drawFormat(m);
      const score = grid.penalty();
      if (score < best) {
        best = score;
        chosen = m;
      }
      grid.applyMask(m);
    }
  }
  grid.applyMask(chosen as number);
  grid.drawFormat(chosen as number);
  return grid.modules;
}

/**
 * An SVG path drawing every dark module as a unit square, offset by `margin`
 * modules (the quiet zone), for a viewBox `size + 2 * margin` wide.
 */
export function qrPath(matrix: QrMatrix, margin = 4): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + margin} ${y + margin}h1v1h-1z`);
    });
  });
  return parts.join("");
}
