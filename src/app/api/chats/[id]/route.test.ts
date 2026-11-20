import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { mockGetUser, mockRevalidate, chats, fail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidate: vi.fn(),
  chats: [] as Row[],
  fail: { on: false },
}));

// delete().eq().eq().select() removes the chats rows matching every filter,
// so a filter the route forgets is a chat it deletes. RLS is the database's
// half, tested in src/test/owner-delete.db.test.ts.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      expect(table).toBe("chats");
      const filters: [string, unknown][] = [];
      const chain = {
        delete: () => chain,
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return chain;
        },
        async select() {
          if (fail.on) return { data: null, error: { message: "boom" } };
          const hit = chats.filter((row) => filters.every(([c, v]) => row[c] === v));
          for (const row of hit) chats.splice(chats.indexOf(row), 1);
          return { data: hit.map((r) => ({ id: r.id })), error: null };
        },
      };
      return chain;
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));

import { DELETE } from "./route";

const OWNER = "user-1";
const ID = "22222222-2222-4222-8222-222222222222";

function del(id = ID) {
  return DELETE(new Request(`http://localhost/api/chats/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

function signIn(id: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

beforeEach(() => {
  fail.on = false;
  chats.length = 0;
  chats.push({ id: ID, user_id: OWNER });
  signIn(OWNER);
  mockRevalidate.mockReset();
});

describe("DELETE /api/chats/[id]", () => {
  it("deletes the owner's chat", async () => {
    const res = await del();
    expect(res.status).toBe(204);
    expect(chats).toEqual([]);
    expect(mockRevalidate).toHaveBeenCalledWith("/account");
  });

  it("refuses a signed-out visitor and changes nothing", async () => {
    signIn(null);
    expect((await del()).status).toBe(401);
    expect(chats).toHaveLength(1);
  });

  it("answers 404 to someone else and changes nothing", async () => {
    signIn("user-2");
    expect((await del()).status).toBe(404);
    expect(chats).toHaveLength(1);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("answers 404 to an id that is not a uuid", async () => {
    expect((await del("nope")).status).toBe(404);
    expect(chats).toHaveLength(1);
  });

  it("answers 500 without the database's message when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fail.on = true;
    const res = await del();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
