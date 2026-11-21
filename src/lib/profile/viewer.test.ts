import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    user: null as { id: string; email: string } | null,
    profile: { data: null as { display_name: string | null } | null, error: null as unknown },
    tables: [] as string[],
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      state.tables.push(table);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => state.profile }) }),
      };
    },
  }),
}));

const { getViewer } = await import("./viewer");

beforeEach(() => {
  state.user = null;
  state.profile = { data: null, error: null };
  state.tables = [];
});

describe("getViewer", () => {
  it("signed out: no user, and no profile read", async () => {
    expect(await getViewer()).toEqual({ user: null, displayName: null });
    expect(state.tables).toEqual([]);
  });

  it("signed in: the user and their display name", async () => {
    state.user = { id: "u1", email: "ada@example.com" };
    state.profile = { data: { display_name: "Ada Lovelace" }, error: null };
    expect(await getViewer()).toEqual({ user: state.user, displayName: "Ada Lovelace" });
  });

  it("a failed profile read is logged and leaves the name null, not a thrown page", async () => {
    state.user = { id: "u1", email: "ada@example.com" };
    state.profile = { data: null, error: { message: "boom" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getViewer()).toEqual({ user: state.user, displayName: null });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
