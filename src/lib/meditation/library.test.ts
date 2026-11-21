import { beforeEach, describe, expect, it, vi } from "vitest";

// A query builder that records every call and resolves to the rows the test
// set for its table, so a test can see both what was asked and what came back.
type Call = [method: string, ...args: unknown[]];
type Result = { data?: unknown; count?: number | null; error: { message: string } | null };

const { state } = vi.hoisted(() => ({
  state: {
    user: null as { id: string; email?: string } | null,
    queries: [] as { table: string; calls: Call[] }[],
    results: {} as Record<string, Result>,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      const query = { table, calls: [] as Call[] };
      state.queries.push(query);
      const builder: Record<string, unknown> = {
        then: (resolve: (r: Result) => unknown) =>
          resolve(state.results[table] ?? { data: [], count: 0, error: null }),
      };
      for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => {
          query.calls.push([method, ...args]);
          return builder;
        };
      }
      return builder;
    },
  }),
}));

const { latestDistinct, getRecentlyPlayed, getLibraryCounts } = await import("./library");

const p = (id: string, t: string) => ({ meditation_id: id, played_at: t });

beforeEach(() => {
  state.user = null;
  state.queries = [];
  state.results = {};
});

describe("latestDistinct", () => {
  it("keeps each meditation once, at its newest play", () => {
    expect(latestDistinct([p("a", "3"), p("b", "2"), p("a", "1")], 8)).toEqual(["a", "b"]);
  });

  it("stops at the limit", () => {
    expect(latestDistinct([p("a", "3"), p("b", "2"), p("c", "1")], 2)).toEqual(["a", "b"]);
  });

  it("is empty with no plays", () => {
    expect(latestDistinct([], 8)).toEqual([]);
  });

  it("counts a meditation played five times once", () => {
    const plays = [p("a", "9"), p("a", "8"), p("a", "7"), p("b", "6"), p("a", "5"), p("a", "4")];
    expect(latestDistinct(plays, 8)).toEqual(["a", "b"]);
  });
});

describe("getRecentlyPlayed", () => {
  it("reads nothing signed out", async () => {
    expect(await getRecentlyPlayed()).toEqual([]);
    expect(state.queries.map((q) => q.table)).not.toContain("meditation_plays");
  });

  it("returns what the caller can still see, in play order, marking their own", async () => {
    state.user = { id: "me" };
    state.results.meditation_plays = {
      data: [p("theirs", "4"), p("gone", "3"), p("mine", "2"), p("theirs", "1")],
      error: null,
    };
    // "gone" went private or was deleted: RLS leaves it out of the read.
    state.results.meditations = {
      data: [
        { id: "mine", user_id: "me", title: "Mine", tags: [], settings: {}, status: "completed" },
        { id: "theirs", user_id: "bob", title: "Theirs", tags: [], settings: {}, status: "completed" },
      ],
      error: null,
    };

    const items = await getRecentlyPlayed(8);

    expect(items.map((m) => [m.id, m.source])).toEqual([
      ["theirs", "discover"],
      ["mine", "yours"],
    ]);
    const plays = state.queries.find((q) => q.table === "meditation_plays")!;
    expect(plays.calls).toContainEqual(["eq", "user_id", "me"]);
    expect(plays.calls).toContainEqual(["order", "played_at", { ascending: false }]);
    // Enough rows to survive repeats.
    expect(plays.calls).toContainEqual(["limit", 40]);
    // Through the caller's own client, and only finished ones.
    const meditations = state.queries.find((q) => q.table === "meditations")!;
    expect(meditations.calls).toContainEqual(["in", "id", ["theirs", "gone", "mine"]]);
    expect(meditations.calls).toContainEqual(["eq", "status", "completed"]);
  });

  it("asks for no meditations when nothing has been played", async () => {
    state.user = { id: "me" };
    expect(await getRecentlyPlayed()).toEqual([]);
    expect(state.queries.map((q) => q.table)).not.toContain("meditations");
  });
});

describe("getLibraryCounts", () => {
  it("counts each place with a head-only count", async () => {
    state.user = { id: "me" };
    state.results = {
      favorites: { count: 12, error: null },
      meditation_bookmarks: { count: 5, error: null },
      meditations: { count: 8, error: null },
      collections: { count: 3, error: null },
    };

    expect(await getLibraryCounts()).toEqual({
      favorites: 12,
      bookmarks: 5,
      meditations: 8,
      collections: 3,
    });
    for (const q of state.queries.filter((q) => q.table !== "user_profiles")) {
      expect(q.calls[0][2]).toEqual({ count: "exact", head: true });
      expect(q.calls).toContainEqual(["eq", "user_id", "me"]);
    }
  });

  it("counts bookmarks by the list's rule: public and completed only", async () => {
    state.user = { id: "me" };
    await getLibraryCounts();
    const bookmarks = state.queries.find((q) => q.table === "meditation_bookmarks")!;
    expect(String(bookmarks.calls[0][1])).toContain("meditations!inner");
    expect(bookmarks.calls).toContainEqual(["eq", "meditation.is_public", true]);
    expect(bookmarks.calls).toContainEqual(["eq", "meditation.status", "completed"]);
  });

  it("counts only favourites whose meditation the caller can still read", async () => {
    state.user = { id: "me" };
    await getLibraryCounts();
    const favorites = state.queries.find((q) => q.table === "favorites")!;
    expect(String(favorites.calls[0][1])).toContain("meditations!inner");
  });

  it("leaves a count out when its read fails, rather than showing 0", async () => {
    state.user = { id: "me" };
    state.results.collections = { count: null, error: { message: "boom" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const counts = await getLibraryCounts();
    expect(counts.collections).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("is all zero signed out, reading nothing", async () => {
    expect(await getLibraryCounts()).toEqual({
      favorites: 0,
      bookmarks: 0,
      meditations: 0,
      collections: 0,
    });
    expect(state.queries).toEqual([]);
  });
});
