import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

type Upload = { path: string; bytes: Buffer; contentType: string };

// The service client storeCover writes through: uploads, the one row update
// and removals are recorded, and the row's current cover_path is `previous`.
const db = vi.hoisted(() => ({
  previous: null as string | null,
  uploads: [] as Upload[],
  updates: [] as { values: Record<string, unknown>; id: string }[],
  removed: [] as string[][],
  failUpdate: false,
  gone: false,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { cover_path: db.previous }, error: null }) }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (_column: string, id: string) => ({
          select: async () => {
            db.updates.push({ values, id });
            if (db.failUpdate) return { data: null, error: { message: "update refused" } };
            return { data: db.gone ? [] : [{ id }], error: null };
          },
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: async (path: string, body: Buffer, options: { contentType: string }) => {
          db.uploads.push({ path, bytes: body, contentType: options.contentType });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          db.removed.push(paths);
          return { error: null };
        },
      }),
    },
  }),
}));

import { isOwnCoverPath, storeCover } from "./store";

const MED = "6f1c2a9e-3b7d-4e21-9a0c-5d8f7e6b1a24";
const OTHER = "0b7a1f3c-2d4e-4f50-8a6b-9c0d1e2f3a4b";

describe("isOwnCoverPath", () => {
  it("is true only for a file directly in the meditation's folder", () => {
    expect(isOwnCoverPath(`${MED}/a1b2.webp`, MED)).toBe(true);
    expect(isOwnCoverPath(`${MED}/a1b2.thumb.webp`, MED)).toBe(true);
  });

  it("is false for another meditation's folder", () => {
    expect(isOwnCoverPath(`${OTHER}/a1b2.webp`, MED)).toBe(false);
    // A prefix of the id is not the id.
    expect(isOwnCoverPath(`${MED}x/a1b2.webp`, MED)).toBe(false);
  });

  it("is false for nested, empty, missing or climbing paths", () => {
    expect(isOwnCoverPath(`${MED}/deeper/a1b2.webp`, MED)).toBe(false);
    expect(isOwnCoverPath(`${MED}/`, MED)).toBe(false);
    expect(isOwnCoverPath("", MED)).toBe(false);
    expect(isOwnCoverPath(null, MED)).toBe(false);
    expect(isOwnCoverPath(`${MED}/../${OTHER}/a.webp`, MED)).toBe(false);
    expect(isOwnCoverPath(`${MED}/..`, MED)).toBe(false);
    expect(isOwnCoverPath(`${MED}/.`, MED)).toBe(false);
    expect(isOwnCoverPath(`/${MED}/a.webp`, MED)).toBe(false);
    expect(isOwnCoverPath(`${MED}/a\\..\\b.webp`, MED)).toBe(false);
  });

  it("is false when the meditation id is not an id", () => {
    expect(isOwnCoverPath("../a.webp", "..")).toBe(false);
    expect(isOwnCoverPath("/a.webp", "")).toBe(false);
  });
});

describe("storeCover", () => {
  let png: Uint8Array;

  beforeEach(async () => {
    db.previous = null;
    db.uploads = [];
    db.updates = [];
    db.removed = [];
    db.failUpdate = false;
    db.gone = false;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    png = new Uint8Array(
      await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#4a6b5d" } }).png().toBuffer(),
    );
  });

  it("writes a 1024px WebP with a 512px middle size and a 256px thumbnail beside it", async () => {
    const { path, url } = await storeCover(MED, { bytes: png, mediaType: "image/png" });

    expect(path).toMatch(new RegExp(`^${MED}/[0-9a-f-]{36}\\.webp$`));
    expect(url).toBe(`https://abc.supabase.co/storage/v1/object/public/meditation-covers/${path}`);
    const byPath = new Map(db.uploads.map((u) => [u.path, u]));
    const full = byPath.get(path)!;
    const middle = byPath.get(path.replace(/\.webp$/, ".md.webp"))!;
    const thumb = byPath.get(path.replace(/\.webp$/, ".thumb.webp"))!;
    expect(db.uploads).toHaveLength(3);
    // The full image last: the smaller sizes exist before anything could point at it.
    expect(db.uploads.at(-1)!.path).toBe(path);
    for (const [upload, edge] of [[full, 1024], [middle, 512], [thumb, 256]] as const) {
      expect(upload.contentType).toBe("image/webp");
      const meta = await sharp(upload.bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", edge, edge]);
    }
    // Only once all three exist does the row point at the new cover.
    expect(db.updates).toEqual([{ values: { cover_path: path }, id: MED }]);
  });

  it("crops a picture that is not square to a square", async () => {
    const wide = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#123456" } }).jpeg().toBuffer();
    await storeCover(MED, { bytes: new Uint8Array(wide), mediaType: "image/jpeg" });
    const meta = await sharp(db.uploads.find((u) => !/\.(thumb|md)\./.test(u.path))!.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([800, 800]);
  });

  it("removes the previous cover and its smaller sizes when they are this meditation's", async () => {
    db.previous = `${MED}/old.webp`;
    await storeCover(MED, { bytes: png, mediaType: "image/png" });
    expect(db.removed).toEqual([[`${MED}/old.webp`, `${MED}/old.md.webp`, `${MED}/old.thumb.webp`]]);
  });

  it("never removes anything outside the meditation's own folder", async () => {
    for (const previous of [`${OTHER}/old.webp`, `${MED}/../${OTHER}/old.webp`, `${MED}/a/b.webp`]) {
      db.previous = previous;
      await storeCover(MED, { bytes: png, mediaType: "image/png" });
    }
    expect(db.removed).toEqual([]);
  });

  it("removes what it uploaded and keeps the old cover when the row update fails", async () => {
    db.previous = `${MED}/old.webp`;
    db.failUpdate = true;
    await expect(storeCover(MED, { bytes: png, mediaType: "image/png" })).rejects.toThrow(/update refused/);
    expect(db.removed.map((paths) => [...paths].sort())).toEqual([db.uploads.map((u) => u.path).sort()]);
  });

  it("removes what it uploaded when the meditation was deleted meanwhile", async () => {
    db.gone = true;
    await expect(storeCover(MED, { bytes: png, mediaType: "image/png" })).rejects.toThrow(/meditation is gone/);
    expect(db.removed.map((paths) => [...paths].sort())).toEqual([db.uploads.map((u) => u.path).sort()]);
  });

  it("refuses a meditation id that is not an id", async () => {
    await expect(storeCover("../x", { bytes: png, mediaType: "image/png" })).rejects.toThrow(/Not a meditation id/);
    expect(db.uploads).toEqual([]);
  });
});
