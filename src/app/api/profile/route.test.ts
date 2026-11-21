import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockRead, mockUpdate, filters } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRead: vi.fn(),
  mockUpdate: vi.fn(),
  filters: [] as [string, unknown][],
}));

// select().eq().maybeSingle() resolves through mockRead;
// update(values).eq().select().maybeSingle() through mockUpdate, which sees
// the values written. The filters either was scoped by land in `filters`.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      expect(table).toBe("user_profiles");
      const eq = (chain: object) => (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      };
      return {
        select: () => {
          const chain: Record<string, unknown> = { maybeSingle: () => mockRead() };
          chain.eq = eq(chain);
          return chain;
        },
        update: (values: unknown) => {
          const chain: Record<string, unknown> = {
            select: () => ({ maybeSingle: () => mockUpdate(values) }),
          };
          chain.eq = eq(chain);
          return chain;
        },
      };
    },
  }),
}));

import { GET, PATCH } from "./route";
import { avatarPublicBase } from "@/lib/profile/avatar";

// Production's project URL is https; the route builds the avatars base from it.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
const AVATARS = avatarPublicBase("https://proj.supabase.co");

const USER = "user-1";
const PROFILE = {
  id: USER,
  display_name: "Ada",
  avatar_url: null,
  bio: null,
  is_public: false,
  created_at: "2026-11-20T00:00:00Z",
  updated_at: "2026-11-20T00:00:00Z",
};

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/profile", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  filters.length = 0;
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: USER } } });
  mockRead.mockReset().mockResolvedValue({ data: PROFILE, error: null });
  mockUpdate.mockReset().mockImplementation(async (values: object) => ({
    data: { ...PROFILE, ...values },
    error: null,
  }));
});

describe("GET /api/profile", () => {
  it("returns the signed-in user's own profile", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PROFILE);
    expect(filters).toEqual([["id", USER]]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refuses a signed-out visitor", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("answers 404 when the row is missing and 500 when the read fails", async () => {
    mockRead.mockResolvedValueOnce({ data: null, error: null });
    expect((await GET()).status).toBe(404);

    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRead.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});

describe("PATCH /api/profile", () => {
  it("writes only the fields sent, scoped to the signed-in user", async () => {
    const res = await patch({ bio: "  Breathwork teacher  " });
    expect(res.status).toBe(200);

    const values = mockUpdate.mock.calls[0][0];
    expect(Object.keys(values).sort()).toEqual(["bio", "updated_at"]);
    expect(values.bio).toBe("Breathwork teacher");
    expect(filters).toEqual([["id", USER]]);
    expect((await res.json()).bio).toBe("Breathwork teacher");
  });

  it("refuses a signed-out visitor", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await patch({ bio: "Hi" })).status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON, or writes a column the owner may not", async () => {
    expect((await patch("{not json")).status).toBe(400);
    expect((await patch({ id: "user-2" })).status).toBe(400);
    expect((await patch({ avatar_url: "http://example.com/a.png" })).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("accepts a photo uploaded to the caller's own avatars folder, and clearing it", async () => {
    const url = `${AVATARS}${USER}/abc.webp`;
    const res = await patch({ avatar_url: url });
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][0].avatar_url).toBe(url);

    expect((await patch({ avatar_url: null })).status).toBe(200);
    expect(mockUpdate.mock.calls[1][0].avatar_url).toBeNull();
  });

  it("refuses an avatar that is not an upload in the caller's own folder", async () => {
    for (const avatar_url of [
      "https://example.com/a.png",
      `${AVATARS}user-2/abc.webp`,
      `${AVATARS}${USER}/nested/abc.webp`,
      `${AVATARS.replace("/avatars/", "/meditation-audio/")}${USER}/abc.mp3`,
    ]) {
      const res = await patch({ avatar_url });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/photo/i);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("leaves a stored external avatar alone when other fields change", async () => {
    mockUpdate.mockImplementationOnce(async (values: object) => ({
      data: { ...PROFILE, avatar_url: "https://example.com/old.png", ...values },
      error: null,
    }));
    const res = await patch({ bio: "Hi" });
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("avatar_url");
    expect((await res.json()).avatar_url).toBe("https://example.com/old.png");
  });

  it("answers 500 without leaking the database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdate.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await patch({ bio: "Hi" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
