import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { mockGetUser, mockRemoveAudio, mockRevalidate, db, fail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRemoveAudio: vi.fn(),
  mockRevalidate: vi.fn(),
  db: {} as Record<string, Row[]>,
  fail: { table: null as string | null },
}));

// A table-backed fake of the caller's client: select and delete apply their
// eq() filters to the rows in `db`, so a filter the route forgets is a row it
// reads or deletes. RLS is the database's half, tested in
// src/test/owner-delete.db.test.ts; this is the route's.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const matches = () =>
        (db[table] ?? []).filter((row) => filters.every(([c, v]) => row[c] === v));
      const error = () => (fail.table === table ? { message: "boom" } : null);
      const chain = {
        mode: "select" as "select" | "delete",
        select() {
          return chain;
        },
        delete() {
          chain.mode = "delete";
          return chain;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return chain;
        },
        async maybeSingle() {
          return { data: matches()[0] ?? null, error: error() };
        },
        then(resolve: (r: { data: Row[] | null; error: unknown }) => void) {
          if (error()) return resolve({ data: null, error: error() });
          const hit = matches();
          if (chain.mode === "delete") db[table] = (db[table] ?? []).filter((r) => !hit.includes(r));
          resolve({ data: hit, error: null });
        },
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/audio/storage", () => ({ removeMeditationAudio: mockRemoveAudio }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));

import { DELETE } from "./route";

const OWNER = "user-1";
const OTHER = "user-2";
const ID = "11111111-1111-4111-8111-111111111111";

function del(id = ID) {
  return DELETE(new Request(`http://localhost/api/meditations/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

function signIn(id: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

beforeEach(() => {
  fail.table = null;
  for (const key of Object.keys(db)) delete db[key];
  db.meditations = [
    { id: ID, user_id: OWNER, status: "completed", is_public: true, audio_path: `${OWNER}/${ID}/a.mp3` },
  ];
  db.meditation_versions = [{ meditation_id: ID, audio_path: `${OWNER}/${ID}/old.mp3` }];
  db.meditation_drafts = [];
  signIn(OWNER);
  mockRemoveAudio.mockReset().mockResolvedValue(undefined);
  mockRevalidate.mockReset();
});

describe("DELETE /api/meditations/[id]", () => {
  it("deletes the owner's meditation, then its audio, and refreshes Discover", async () => {
    const res = await del();
    expect(res.status).toBe(204);
    expect(db.meditations).toEqual([]);
    expect(mockRemoveAudio).toHaveBeenCalledWith(OWNER, ID, [
      `${OWNER}/${ID}/a.mp3`,
      `${OWNER}/${ID}/old.mp3`,
    ]);
    expect(mockRevalidate).toHaveBeenCalledWith("/discover");
    expect(mockRevalidate).toHaveBeenCalledWith(`/meditation/${ID}`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refuses a signed-out visitor and changes nothing", async () => {
    signIn(null);
    expect((await del()).status).toBe(401);
    expect(db.meditations).toHaveLength(1);
    expect(mockRemoveAudio).not.toHaveBeenCalled();
  });

  it("answers 404 to someone else, even on a public meditation, and changes nothing", async () => {
    signIn(OTHER);
    const res = await del();
    expect(res.status).toBe(404);
    expect(db.meditations).toHaveLength(1);
    expect(mockRemoveAudio).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("answers 404 to an id that is not a uuid without asking the database", async () => {
    fail.table = "meditations";
    expect((await del("not-a-uuid")).status).toBe(404);
  });

  it.each([
    ["the current version is rendering", { status: "processing_audio" }, null],
    ["a draft is rendering", {}, "processing"],
  ])("answers 409 while %s, and changes nothing", async (_label, patch, renderStatus) => {
    Object.assign(db.meditations[0], patch);
    if (renderStatus) db.meditation_drafts = [{ meditation_id: ID, render_status: renderStatus }];
    expect((await del()).status).toBe(409);
    expect(db.meditations).toHaveLength(1);
    expect(mockRemoveAudio).not.toHaveBeenCalled();
  });

  it("allows a draft whose last render failed", async () => {
    db.meditation_drafts = [{ meditation_id: ID, render_status: "failed" }];
    expect((await del()).status).toBe(204);
  });

  it("still answers 204 when removing the audio fails: the row is gone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRemoveAudio.mockRejectedValue(new Error("storage down"));
    expect((await del()).status).toBe(204);
    expect(db.meditations).toEqual([]);
  });

  it("answers 500 without the database's message when a read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fail.table = "meditation_versions";
    const res = await del();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    expect(db.meditations).toHaveLength(1);
  });
});
