import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockList } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockList: vi.fn(),
}));

const supabase = { auth: { getUser: mockGetUser } };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));

// The query itself (the join, the visibility filter, the keyset paging) is
// PostgREST's half, tested in src/test/meditation-bookmarks.db.test.ts. Here:
// who may call, what the URL may say, and what comes back.
vi.mock("@/lib/meditation/bookmarks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/meditation/bookmarks")>()),
  listBookmarks: mockList,
}));

import { GET } from "./route";
import { encodeCursor } from "@/lib/meditation/bookmarks";

const get = (query = "") => GET(new Request(`http://localhost/api/bookmarks${query}`));
const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-20T10:00:00.123456+00:00";

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
  mockList.mockReset().mockResolvedValue({ bookmarks: [], next_cursor: null });
});

describe("GET /api/bookmarks", () => {
  it("lists the caller's bookmarks, 50 from the start by default", async () => {
    const page = {
      bookmarks: [{ bookmarked_at: AT, meditation: { id: ID, title: "Rest", author: null, rating: null } }],
      next_cursor: "abc",
    };
    mockList.mockResolvedValue(page);

    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual(page);
    expect(mockList).toHaveBeenCalledWith(supabase, "user-2", { limit: 50, cursor: null });
  });

  it("passes a limit and cursor through", async () => {
    await get(`?limit=10&cursor=${encodeCursor({ created_at: AT, meditation_id: ID })}`);
    expect(mockList).toHaveBeenCalledWith(supabase, "user-2", {
      limit: 10,
      cursor: { created_at: AT, meditation_id: ID },
    });
  });

  it("is 401 signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await get()).status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("is 400 for a bad limit or cursor", async () => {
    for (const query of ["?limit=0", "?limit=500", "?cursor=nope"]) {
      const res = await get(query);
      expect(res.status, query).toBe(400);
      expect((await res.json()).error).toMatch(/./);
    }
    expect(mockList).not.toHaveBeenCalled();
  });

  it("is 500 when the list fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockList.mockRejectedValue(new Error("boom"));
    expect((await get()).status).toBe(500);
  });
});
