import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_BOOKMARK_PAGE,
  MAX_BOOKMARK_LOOKUP,
  MAX_BOOKMARK_PAGE,
  decodeCursor,
  encodeCursor,
  getBookmarkedIds,
  parseBookmarkPage,
} from "./bookmarks";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const AT = "2026-11-20T10:00:00.123456+00:00";

/** A fake client recording each query's filters; every query returns `rows`. */
function client(rows: { meditation_id: string }[] = [], error: unknown = null) {
  const queries: { table: string; eq: [string, unknown][]; in: [string, string[]][] }[] = [];
  const from = vi.fn((table: string) => {
    const q = { table, eq: [] as [string, unknown][], in: [] as [string, string[]][] };
    queries.push(q);
    const chain = {
      select: () => chain,
      eq: (c: string, v: unknown) => (q.eq.push([c, v]), chain),
      in: (c: string, v: string[]) => {
        q.in.push([c, v]);
        return Promise.resolve({ data: error ? null : rows.filter((r) => v.includes(r.meditation_id)), error });
      },
    };
    return chain;
  });
  return { from, queries };
}

describe("getBookmarkedIds", () => {
  it("returns the caller's bookmarked ids among those asked, in one query", async () => {
    const supabase = client([{ meditation_id: id(1) }, { meditation_id: id(3) }]);
    const found = await getBookmarkedIds(supabase as never, "user-1", [id(1), id(2), id(3)]);

    expect(found).toEqual(new Set([id(1), id(3)]));
    expect(supabase.queries).toEqual([
      { table: "meditation_bookmarks", eq: [["user_id", "user-1"]], in: [["meditation_id", [id(1), id(2), id(3)]]] },
    ]);
  });

  it("reads nothing signed out or for no ids", async () => {
    const supabase = client();
    expect(await getBookmarkedIds(supabase as never, null, [id(1)])).toEqual(new Set());
    expect(await getBookmarkedIds(supabase as never, undefined, [id(1)])).toEqual(new Set());
    expect(await getBookmarkedIds(supabase as never, "user-1", [])).toEqual(new Set());
    expect(await getBookmarkedIds(supabase as never, "user-1", ["not-a-uuid"])).toEqual(new Set());
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("dedupes and batches past the lookup limit", async () => {
    const supabase = client();
    const ids = Array.from({ length: MAX_BOOKMARK_LOOKUP + 1 }, (_, i) => id(i));
    await getBookmarkedIds(supabase as never, "user-1", [...ids, id(0)]);
    expect(supabase.queries).toHaveLength(2);
    expect(supabase.queries[0].in[0][1]).toHaveLength(MAX_BOOKMARK_LOOKUP);
    expect(supabase.queries[1].in[0][1]).toEqual([id(MAX_BOOKMARK_LOOKUP)]);
  });

  it("throws when the lookup fails", async () => {
    await expect(getBookmarkedIds(client([], { message: "boom" }) as never, "user-1", [id(1)])).rejects.toThrow("boom");
  });
});

describe("cursors", () => {
  it("round-trip without losing microseconds", () => {
    const cursor = { created_at: AT, meditation_id: id(7) };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor(encodeCursor({ created_at: "2026-11-20T10:00:00Z", meditation_id: id(7) }))).not.toBeNull();
  });

  it("refuse anything this list did not give out", () => {
    const bad = (s: string) => Buffer.from(s).toString("base64url");
    for (const raw of [
      "",
      "garbage",
      bad(`${AT}`),
      bad(`${AT}|not-a-uuid`),
      bad(`yesterday|${id(1)}`),
      bad(`${AT}|${id(1)}|extra`),
      bad(`${AT}",meditation_id.gt.0|${id(1)}`),
    ]) {
      expect(decodeCursor(raw), raw).toBeNull();
    }
  });
});

describe("parseBookmarkPage", () => {
  const parse = (query: string) => parseBookmarkPage(new URLSearchParams(query));

  it("defaults to the first page of 50", () => {
    expect(parse("")).toEqual({ ok: true, limit: DEFAULT_BOOKMARK_PAGE, cursor: null });
  });

  it("reads a limit from 1 to 100 and a cursor", () => {
    const cursor = encodeCursor({ created_at: AT, meditation_id: id(1) });
    expect(parse(`limit=1&cursor=${cursor}`)).toEqual({
      ok: true,
      limit: 1,
      cursor: { created_at: AT, meditation_id: id(1) },
    });
    expect(parse(`limit=${MAX_BOOKMARK_PAGE}`)).toMatchObject({ ok: true, limit: MAX_BOOKMARK_PAGE });
  });

  it("refuses a bad limit or cursor with a message", () => {
    for (const query of ["limit=0", "limit=101", "limit=2.5", "limit=-1", "limit=ten", "limit=", "cursor=nope"]) {
      const result = parse(query);
      expect(result.ok, query).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/./);
    }
  });
});
