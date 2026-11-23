import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockList, mockHydrate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockList: vi.fn(),
  mockHydrate: vi.fn(),
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

// The signer: each row comes back with a URL named for its id.
vi.mock("@/lib/audio/signed-url", () => ({ hydrateAudioUrls: mockHydrate }));

import { GET } from "./route";
import { encodeCursor } from "@/lib/meditation/bookmarks";

const get = (query = "") => GET(new Request(`http://localhost/api/bookmarks${query}`));
const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-20T10:00:00.123456+00:00";

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
  mockList.mockReset().mockResolvedValue({ bookmarks: [], next_cursor: null });
  mockHydrate
    .mockReset()
    .mockImplementation(async (rows: { id: string }[]) => rows.map((r) => ({ ...r, audio_url: `signed:${r.id}` })));
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
    expect(await res.json()).toEqual({
      bookmarks: [{ ...page.bookmarks[0], meditation: { ...page.bookmarks[0].meditation, audio_url: `signed:${ID}` } }],
      next_cursor: "abc",
    });
    expect(mockList).toHaveBeenCalledWith(supabase, "user-2", { limit: 50, cursor: null });
  });

  it("signs the audio of every row on a later page too, by id alone", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    mockList.mockResolvedValue({
      bookmarks: [ID, other].map((id) => ({ bookmarked_at: AT, meditation: { id, title: id, author: null, rating: null } })),
      next_cursor: null,
    });

    const res = await get(`?limit=2&cursor=${encodeCursor({ created_at: AT, meditation_id: ID })}`);
    const body = await res.json();
    expect(body.bookmarks.map((b: { meditation: { audio_url: string } }) => b.meditation.audio_url)).toEqual([
      `signed:${ID}`,
      `signed:${other}`,
    ]);
    expect(mockHydrate).toHaveBeenCalledWith([{ id: ID }, { id: other }]);
  });

  it("still lists the page, without audio, when signing fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockHydrate.mockRejectedValue(new Error("no service-role key"));
    mockList.mockResolvedValue({
      bookmarks: [{ bookmarked_at: AT, meditation: { id: ID, title: "Rest", author: null, rating: null } }],
      next_cursor: null,
    });

    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).bookmarks[0].meditation.audio_url).toBeNull();
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
