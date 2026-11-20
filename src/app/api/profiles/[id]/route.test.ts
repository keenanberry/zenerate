import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRead, mockRpc, filters } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockRpc: vi.fn(),
  filters: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      expect(table).toBe("user_profiles");
      return {
        select: () => {
          const chain: Record<string, unknown> = { maybeSingle: () => mockRead() };
          chain.eq = (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          };
          return chain;
        },
      };
    },
    rpc: mockRpc,
  }),
}));

import { GET } from "./route";

const ID = "11111111-1111-1111-1111-111111111111";
const PROFILE = {
  id: ID,
  display_name: "Ada",
  avatar_url: null,
  bio: "Breathwork teacher",
  is_public: true,
  created_at: "2026-11-20T00:00:00Z",
};
const MEDITATION = { id: "med-1", title: "Evening", script: "Breathe in…", status: "completed" };

function get(id: string) {
  return GET(new Request(`http://localhost/api/profiles/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  filters.length = 0;
  mockRead.mockReset().mockResolvedValue({ data: PROFILE, error: null });
  mockRpc.mockReset().mockResolvedValue({ data: [MEDITATION], error: null });
});

describe("GET /api/profiles/[id]", () => {
  it("returns the public profile and its meditations, without scripts", async () => {
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      profile: PROFILE,
      meditations: [{ id: "med-1", title: "Evening", status: "completed" }],
    });
    expect(filters).toEqual([["id", ID]]);
    expect(mockRpc).toHaveBeenCalledWith("profile_meditations", { p_profile_id: ID });
  });

  it("answers 404 for a profile RLS does not return, as for a missing one", async () => {
    mockRead.mockResolvedValue({ data: null, error: null });
    const res = await get(ID);
    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers 404 for an id that is not a UUID, without querying", async () => {
    expect((await get("alice")).status).toBe(404);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("answers 500 without leaking the database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await get(ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
