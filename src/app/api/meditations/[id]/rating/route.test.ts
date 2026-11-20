import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { mockGetUser, mockRevalidate, db, fail, beforeInsert, session } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidate: vi.fn(),
  db: {} as Record<string, Row[]>,
  fail: { table: null as string | null, code: undefined as string | undefined },
  // Runs just before an insert applies: another request landing in between.
  beforeInsert: { fn: null as (() => void) | null },
  session: { userId: null as string | null },
}));

// A table-backed fake of the caller's client. select, update, delete and
// insert apply their eq() filters to the rows in `db`, so a filter the route
// forgets is a row it reads or writes. Meditations are read as RLS would
// show them (own or public), and the primary key on meditation_ratings
// answers a duplicate insert with 23505. The policies themselves are the
// database's half, tested in src/test/meditation-ratings.db.test.ts.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let mode: "select" | "update" | "delete" | "insert" = "select";
      let patch: Row = {};
      const visible = () =>
        (db[table] ?? []).filter(
          (row) => table !== "meditations" || row.is_public || row.user_id === session.userId,
        );
      const matches = () => visible().filter((row) => filters.every(([c, v]) => row[c] === v));
      const failure = () => (fail.table === table ? { message: "boom", code: fail.code } : null);
      const pick = (row: Row) => ({ stars: row.stars, created_at: row.created_at, updated_at: row.updated_at });

      function run(): { data: Row[] | null; error: unknown } {
        if (failure()) return { data: null, error: failure() };
        if (mode === "insert") {
          beforeInsert.fn?.();
          const rows = (db[table] ??= []);
          if (rows.some((r) => r.meditation_id === patch.meditation_id && r.user_id === patch.user_id)) {
            return { data: null, error: { message: "duplicate key", code: "23505" } };
          }
          const row = { ...patch, created_at: "t-created", updated_at: "t-created" };
          rows.push(row);
          return { data: [pick(row)], error: null };
        }
        const hit = matches();
        if (mode === "update") for (const row of hit) Object.assign(row, patch, { updated_at: "t-updated" });
        if (mode === "delete") db[table] = (db[table] ?? []).filter((r) => !hit.includes(r));
        return { data: table === "meditation_ratings" ? hit.map(pick) : hit, error: null };
      }

      const chain = {
        select() {
          return chain;
        },
        update(values: Row) {
          mode = "update";
          patch = values;
          return chain;
        },
        insert(values: Row) {
          mode = "insert";
          patch = values;
          return chain;
        },
        delete() {
          mode = "delete";
          return chain;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return chain;
        },
        async maybeSingle() {
          const { data, error } = run();
          return { data: data?.[0] ?? null, error };
        },
        async single() {
          const { data, error } = run();
          return { data: data?.[0] ?? null, error };
        },
        then(resolve: (r: { data: Row[] | null; error: unknown }) => void) {
          resolve(run());
        },
      };
      return chain;
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));

import { DELETE, GET, PUT } from "./route";

const OWNER = "user-1";
const LISTENER = "user-2";
const OTHER = "user-3";
const ID = "11111111-1111-4111-8111-111111111111";
const PRIVATE_ID = "22222222-2222-4222-8222-222222222222";
const MISSING_ID = "33333333-3333-4333-8333-333333333333";
const UNFINISHED_ID = "44444444-4444-4444-8444-444444444444";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const url = (id: string) => `http://localhost/api/meditations/${id}/rating`;

function put(body: unknown, id = ID) {
  const init = { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) };
  return PUT(new Request(url(id), init), ctx(id));
}
const get = (id = ID) => GET(new Request(url(id)), ctx(id));
const del = (id = ID) => DELETE(new Request(url(id), { method: "DELETE" }), ctx(id));

function signIn(id: string | null) {
  session.userId = id;
  mockGetUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

const ratings = () => db.meditation_ratings;

beforeEach(() => {
  fail.table = null;
  fail.code = undefined;
  beforeInsert.fn = null;
  for (const key of Object.keys(db)) delete db[key];
  db.meditations = [
    { id: ID, user_id: OWNER, status: "completed", is_public: true },
    { id: PRIVATE_ID, user_id: OWNER, status: "completed", is_public: false },
  ];
  db.meditation_ratings = [];
  signIn(LISTENER);
  mockRevalidate.mockReset();
});

describe("PUT /api/meditations/[id]/rating", () => {
  it("creates the listener's rating (201), then changes it in place (200)", async () => {
    const created = await put({ stars: 4 });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({
      rating: { stars: 4, created_at: "t-created", updated_at: "t-created" },
    });
    expect(created.headers.get("Cache-Control")).toBe("no-store");

    const changed = await put({ stars: 2 });
    expect(changed.status).toBe(200);
    expect((await changed.json()).rating).toEqual({ stars: 2, created_at: "t-created", updated_at: "t-updated" });

    expect(ratings()).toEqual([
      { meditation_id: ID, user_id: LISTENER, stars: 2, created_at: "t-created", updated_at: "t-updated" },
    ]);
    expect(mockRevalidate).toHaveBeenCalledWith("/discover");
    expect(mockRevalidate).toHaveBeenCalledWith(`/meditation/${ID}`);
  });

  it("changes only the caller's row, never another listener's", async () => {
    db.meditation_ratings.push({ meditation_id: ID, user_id: OTHER, stars: 5 });
    expect((await put({ stars: 1 })).status).toBe(201);
    expect(ratings().find((r) => r.user_id === OTHER)!.stars).toBe(5);
    expect(ratings().find((r) => r.user_id === LISTENER)!.stars).toBe(1);
  });

  it("updates instead when a concurrent request inserted first", async () => {
    beforeInsert.fn = () => {
      db.meditation_ratings.push({ meditation_id: ID, user_id: LISTENER, stars: 5, created_at: "t0", updated_at: "t0" });
      beforeInsert.fn = null;
    };
    const res = await put({ stars: 3 });
    expect(res.status).toBe(200);
    expect(ratings()).toHaveLength(1);
    expect(ratings()[0].stars).toBe(3);
  });

  it.each([
    ["zero", { stars: 0 }],
    ["six", { stars: 6 }],
    ["a fraction", { stars: 3.5 }],
    ["a string", { stars: "4" }],
    ["null", { stars: null }],
    ["missing", {}],
    ["an extra field", { stars: 4, user_id: OTHER }],
    ["not an object", [4]],
  ])("refuses stars that are %s with 400 and writes nothing", async (_, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/./);
    expect(ratings()).toEqual([]);
  });

  it("refuses a body that is not JSON", async () => {
    expect((await put("{nope")).status).toBe(400);
  });

  it("refuses a signed-out visitor with 401", async () => {
    signIn(null);
    expect((await put({ stars: 4 })).status).toBe(401);
    expect(ratings()).toEqual([]);
  });

  it("answers 404 for a private, missing, unfinished or malformed meditation", async () => {
    db.meditations.push({ id: UNFINISHED_ID, user_id: OWNER, status: "processing_audio", is_public: true });
    for (const id of [PRIVATE_ID, MISSING_ID, UNFINISHED_ID, "not-a-uuid"]) {
      expect((await put({ stars: 4 }, id)).status, id).toBe(404);
    }
    expect(ratings()).toEqual([]);
  });

  it("answers 404 to the owner of a private meditation too", async () => {
    signIn(OWNER);
    expect((await put({ stars: 5 }, PRIVATE_ID)).status).toBe(404);
  });

  it("refuses the owner rating their own public meditation with 403", async () => {
    signIn(OWNER);
    const res = await put({ stars: 5 });
    expect(res.status).toBe(403);
    expect(ratings()).toEqual([]);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("answers 404 when the policy refuses the write (made private meanwhile)", async () => {
    fail.table = "meditation_ratings";
    fail.code = "42501";
    expect((await put({ stars: 4 })).status).toBe(404);
  });

  it("answers 500 when the database fails", async () => {
    fail.table = "meditation_ratings";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await put({ stars: 4 })).status).toBe(500);
  });
});

describe("GET /api/meditations/[id]/rating", () => {
  it("returns null before rating, then the listener's own rating", async () => {
    expect(await (await get()).json()).toEqual({ rating: null });
    db.meditation_ratings.push(
      { meditation_id: ID, user_id: OTHER, stars: 1, created_at: "a", updated_at: "a" },
      { meditation_id: ID, user_id: LISTENER, stars: 4, created_at: "b", updated_at: "c" },
    );
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rating: { stars: 4, created_at: "b", updated_at: "c" } });
  });

  it("does not show another listener's rating", async () => {
    db.meditation_ratings.push({ meditation_id: ID, user_id: OTHER, stars: 1 });
    expect(await (await get()).json()).toEqual({ rating: null });
  });

  it("returns null to the owner, who has no rating of their own work", async () => {
    signIn(OWNER);
    expect(await (await get()).json()).toEqual({ rating: null });
  });

  it("refuses a signed-out visitor with 401, and 404s private or missing meditations", async () => {
    expect((await get(PRIVATE_ID)).status).toBe(404);
    expect((await get(MISSING_ID)).status).toBe(404);
    signIn(null);
    expect((await get()).status).toBe(401);
  });
});

describe("DELETE /api/meditations/[id]/rating", () => {
  it("removes the listener's own rating and leaves others", async () => {
    db.meditation_ratings.push(
      { meditation_id: ID, user_id: OTHER, stars: 1 },
      { meditation_id: ID, user_id: LISTENER, stars: 4 },
    );
    const res = await del();
    expect(res.status).toBe(204);
    expect(ratings()).toEqual([{ meditation_id: ID, user_id: OTHER, stars: 1 }]);
    expect(mockRevalidate).toHaveBeenCalledWith("/discover");
  });

  it("succeeds with nothing to remove on a rateable meditation", async () => {
    expect((await del()).status).toBe(204);
  });

  it("still removes a rating on a meditation made private since", async () => {
    db.meditation_ratings.push({ meditation_id: PRIVATE_ID, user_id: LISTENER, stars: 4 });
    expect((await del(PRIVATE_ID)).status).toBe(204);
    expect(ratings()).toEqual([]);
  });

  it("404s with nothing to remove on a private or missing meditation, and 401s signed out", async () => {
    expect((await del(PRIVATE_ID)).status).toBe(404);
    expect((await del(MISSING_ID)).status).toBe(404);
    expect((await del("not-a-uuid")).status).toBe(404);
    signIn(null);
    expect((await del()).status).toBe(401);
  });
});
