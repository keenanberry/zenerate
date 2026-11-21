import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

type Upload = { path: string; bytes: Buffer; contentType: string };

// The service client storeCover writes through: uploads, the one row update
// and removals are recorded. storeCover reads the row's cover_path as
// `previous`; by the time it updates the row, the cover may have become
// `changedTo` (a studio cover made meanwhile).
const db = vi.hoisted(() => ({
  previous: null as string | null,
  changedTo: undefined as string | null | undefined,
  conditions: [] as string[],
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
      update: (values: Record<string, unknown>) => {
        let id = "";
        // Each condition on the row's cover_path, checked against what it holds now.
        const holds: boolean[] = [];
        const current = () => (db.changedTo === undefined ? db.previous : db.changedTo);
        const builder = {
          eq: (column: string, value: string) => {
            if (column === "id") id = value;
            else {
              db.conditions.push(`${column} = ${value}`);
              holds.push(current() === value);
            }
            return builder;
          },
          is: (column: string, value: null) => {
            db.conditions.push(`${column} is ${value}`);
            holds.push(current() === null);
            return builder;
          },
          select: async () => {
            db.updates.push({ values, id });
            if (db.failUpdate) return { data: null, error: { message: "update refused" } };
            return { data: db.gone || holds.includes(false) ? [] : [{ id }], error: null };
          },
        };
        return builder;
      },
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

import { CoverChangedError, isOwnCoverPath, storeCover } from "./store";

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
    db.changedTo = undefined;
    db.conditions = [];
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

  it("writes unconditionally by default, as the studio does", async () => {
    await storeCover(MED, { bytes: png, mediaType: "image/png" });
    expect(db.conditions).toEqual([]);
  });

  describe("only if the cover is still what the caller saw (the backfill)", () => {
    it("stores the cover when the meditation still has none", async () => {
      const { path } = await storeCover(MED, { bytes: png, mediaType: "image/png" }, { ifCoverIs: null });
      expect(db.conditions).toEqual(["cover_path is null"]);
      expect(db.updates).toEqual([{ values: { cover_path: path }, id: MED }]);
      expect(db.removed).toEqual([]);
    });

    it("keeps a cover that appeared since, and removes its own uploads", async () => {
      db.changedTo = `${MED}/studio.webp`;
      await expect(storeCover(MED, { bytes: png, mediaType: "image/png" }, { ifCoverIs: null })).rejects.toThrow(
        CoverChangedError,
      );
      // Only the three it uploaded are removed; the studio's cover is untouched.
      expect(db.removed.map((paths) => [...paths].sort())).toEqual([db.uploads.map((u) => u.path).sort()]);
      expect(db.removed.flat()).not.toContain(`${MED}/studio.webp`);
    });

    it("keeps a cover that appeared even when storeCover's own read already saw it", async () => {
      // The studio's cover landed before storeCover read the row.
      db.previous = `${MED}/studio.webp`;
      await expect(storeCover(MED, { bytes: png, mediaType: "image/png" }, { ifCoverIs: null })).rejects.toThrow(
        CoverChangedError,
      );
      expect(db.removed.flat()).not.toContain(`${MED}/studio.webp`);
    });

    it("replaces a named cover only while it is still that cover", async () => {
      db.previous = `${MED}/old.webp`;
      await storeCover(MED, { bytes: png, mediaType: "image/png" }, { ifCoverIs: `${MED}/old.webp` });
      expect(db.conditions).toEqual([`cover_path = ${MED}/old.webp`]);
      expect(db.removed).toEqual([[`${MED}/old.webp`, `${MED}/old.md.webp`, `${MED}/old.thumb.webp`]]);

      db.removed = [];
      db.uploads = [];
      db.changedTo = `${MED}/studio.webp`;
      await expect(
        storeCover(MED, { bytes: png, mediaType: "image/png" }, { ifCoverIs: `${MED}/old.webp` }),
      ).rejects.toThrow(CoverChangedError);
      expect(db.removed.flat()).not.toContain(`${MED}/studio.webp`);
      expect(db.removed.flat()).not.toContain(`${MED}/old.webp`);
    });
  });

  it("refuses a meditation id that is not an id", async () => {
    await expect(storeCover("../x", { bytes: png, mediaType: "image/png" })).rejects.toThrow(/Not a meditation id/);
    expect(db.uploads).toEqual([]);
  });
});
