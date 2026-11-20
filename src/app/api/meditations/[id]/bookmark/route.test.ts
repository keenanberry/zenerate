import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { mockGetUser, db, fail, beforeInsert, session } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  db: {} as Record<string, Row[]>,
  fail: { table: null as string | null, code: undefined as string | undefined },
  // Runs just before an insert applies: another request landing in between.
  beforeInsert: { fn: null as (() => void) | null },
  session: { userId: null as string | null },
}));

// A table-backed fake of the caller's client, as in the rating route's test.
// select, delete and insert apply their eq() filters to the rows in `db`.
// Meditations and bookmarks are read as RLS would show them (meditations own
// or public; bookmarks own only), and the primary key answers a duplicate
// insert with 23505. The policies themselves are the database's half, tested
// in src/test/meditation-bookmarks.db.test.ts.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let mode: "select" | "delete" | "insert" = "select";
      let patch: Row = {};
      const visible = () =>
        (db[table] ?? []).filter((row) =>
          table === "meditations"
            ? row.is_public || row.user_id === session.userId
            : row.user_id === session.userId,
        );
      const matches = () => visible().filter((row) => filters.every(([c, v]) => row[c] === v));

      function run(): { data: Row[] | null; error: unknown } {
        if (fail.table === table) return { data: null, error: { message: "boom", code: fail.code } };
        if (mode === "insert") {
          beforeInsert.fn?.();
          const rows = (db[table] ??= []);
          if (rows.some((r) => r.meditation_id === patch.meditation_id && r.user_id === patch.user_id)) {
            return { data: null, error: { message: "duplicate key", code: "23505" } };
          }
          rows.push({ ...patch, created_at: "t-created" });
          return { data: null, error: null };
        }
        const hit = matches();
        if (mode === "delete") db[table] = (db[table] ?? []).filter((r) => !hit.includes(r));
        return { data: hit, error: null };
      }

      const chain = {
        select() {
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
        then(resolve: (r: { data: Row[] | null; error: unknown }) => void) {
          resolve(run());
        },
      };
      return chain;
    },
  }),
}));

import { DELETE, PUT } from "./route";

const OWNER = "user-1";
const LISTENER = "user-2";
const OTHER = "user-3";
const ID = "11111111-1111-4111-8111-111111111111";
const PRIVATE_ID = "22222222-2222-4222-8222-222222222222";
const MISSING_ID = "33333333-3333-4333-8333-333333333333";
const UNFINISHED_ID = "44444444-4444-4444-8444-444444444444";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const url = (id: string) => `http://localhost/api/meditations/${id}/bookmark`;
const put = (id = ID) => PUT(new Request(url(id), { method: "PUT" }), ctx(id));
const del = (id = ID) => DELETE(new Request(url(id), { method: "DELETE" }), ctx(id));

function signIn(id: string | null) {
  session.userId = id;
  mockGetUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

const bookmarks = () => db.meditation_bookmarks.map((r) => ({ user_id: r.user_id, meditation_id: r.meditation_id }));

beforeEach(() => {
  fail.table = null;
  fail.code = undefined;
  beforeInsert.fn = null;
  for (const key of Object.keys(db)) delete db[key];
  db.meditations = [
    { id: ID, user_id: OWNER, status: "completed", is_public: true },
    { id: PRIVATE_ID, user_id: OWNER, status: "completed", is_public: false },
    { id: UNFINISHED_ID, user_id: LISTENER, status: "script_ready", is_public: false },
  ];
  db.meditation_bookmarks = [];
  signIn(LISTENER);
});

describe("PUT /api/meditations/[id]/bookmark", () => {
  it("adds the bookmark (201), and again is a harmless 200", async () => {
    const created = await put();
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ bookmarked: true });
    expect(created.headers.get("Cache-Control")).toBe("no-store");

    const again = await put();
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ bookmarked: true });
    expect(bookmarks()).toEqual([{ user_id: LISTENER, meditation_id: ID }]);
  });

  it("lets the owner bookmark their own public meditation, as with favorites", async () => {
    signIn(OWNER);
    expect((await put()).status).toBe(201);
  });

  it("is 401 signed out, and writes nothing", async () => {
    signIn(null);
    const res = await put();
    expect(res.status).toBe(401);
    expect(bookmarks()).toEqual([]);
  });

  it("is 404 for a private, unfinished, missing or malformed meditation", async () => {
    for (const id of [PRIVATE_ID, UNFINISHED_ID, MISSING_ID, "nope"]) {
      expect((await put(id)).status, id).toBe(404);
    }
    // Even the owner's own private one: only public meditations are saved.
    signIn(OWNER);
    expect((await put(PRIVATE_ID)).status).toBe(404);
    expect(bookmarks()).toEqual([]);
  });

  it("is 200 when a concurrent request inserted first", async () => {
    beforeInsert.fn = () => db.meditation_bookmarks.push({ user_id: LISTENER, meditation_id: ID });
    const res = await put();
    expect(res.status).toBe(200);
  });

  it("is 404 when the policy refuses the row (it went private meanwhile)", async () => {
    fail.table = "meditation_bookmarks";
    fail.code = "42501";
    expect((await put()).status).toBe(404);
  });

  it("is 500 on any other failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fail.table = "meditation_bookmarks";
    expect((await put()).status).toBe(500);
    fail.table = "meditations";
    expect((await put()).status).toBe(500);
  });
});

describe("DELETE /api/meditations/[id]/bookmark", () => {
  it("removes the bookmark (204), and again is a harmless 204", async () => {
    await put();
    const res = await del();
    expect(res.status).toBe(204);
    expect(bookmarks()).toEqual([]);
    expect((await del()).status).toBe(204);
  });

  it("removes only the caller's own bookmark", async () => {
    db.meditation_bookmarks.push({ user_id: OTHER, meditation_id: ID });
    await put();
    expect((await del()).status).toBe(204);
    expect(bookmarks()).toEqual([{ user_id: OTHER, meditation_id: ID }]);
  });

  it("removes a bookmark on a meditation that has gone private since", async () => {
    await put();
    db.meditations[0].is_public = false;
    expect((await del()).status).toBe(204);
    expect(bookmarks()).toEqual([]);
  });

  it("is 404 with nothing to remove on a meditation that cannot be bookmarked", async () => {
    for (const id of [PRIVATE_ID, MISSING_ID, "nope"]) expect((await del(id)).status, id).toBe(404);
  });

  it("is 401 signed out, and removes nothing", async () => {
    await put();
    signIn(null);
    expect((await del()).status).toBe(401);
    expect(bookmarks()).toHaveLength(1);
  });

  it("is 500 when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fail.table = "meditation_bookmarks";
    expect((await del()).status).toBe(500);
  });
});
