import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, reads, rows } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  reads: [] as { table: string; in?: unknown[] }[],
  rows: { meditation_bookmarks: [] as { meditation_id: string }[] },
}));

const MEDITATIONS = [
  { id: "00000000-0000-4000-8000-000000000001", is_public: true, status: "completed" },
  { id: "00000000-0000-4000-8000-000000000002", is_public: true, status: "completed" },
  { id: "00000000-0000-4000-8000-000000000003", is_public: true, status: "completed" },
];

// Every table read is recorded, so the test can count the bookmark lookups.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    rpc: async () => ({ data: MEDITATIONS.map((m) => ({ ...m })), error: null }),
    from: (table: string) => ({
      select: () => {
        const read: { table: string; in?: unknown[] } = { table };
        reads.push(read);
        const result = {
          data: table === "meditation_bookmarks" ? rows.meditation_bookmarks : [],
          error: null,
        };
        const chain = {
          eq: () => chain,
          in: (_: string, values: unknown[]) => {
            read.in = values;
            return chain;
          },
          then: (resolve: (r: typeof result) => unknown) => resolve(result),
        };
        return chain;
      },
    }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audio/signed-url", () => ({
  hydrateAudioUrls: async (m: unknown) => m,
  hydrateAudioUrl: async (m: unknown) => m,
}));

import { getPublicMeditations } from "./actions";

beforeEach(() => {
  reads.length = 0;
  rows.meditation_bookmarks = [];
});

describe("Discover's bookmark state (card ZEN-8)", () => {
  it("is read in one lookup for the whole list, never per card", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rows.meditation_bookmarks = [{ meditation_id: MEDITATIONS[1].id }];

    const found = await getPublicMeditations();

    const lookups = reads.filter((r) => r.table === "meditation_bookmarks");
    expect(lookups).toHaveLength(1);
    expect(lookups[0].in).toEqual(MEDITATIONS.map((m) => m.id));
    expect(found.map((m) => m.is_bookmarked)).toEqual([false, true, false]);
  });

  it("reads nothing signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const found = await getPublicMeditations();

    expect(reads.filter((r) => r.table === "meditation_bookmarks")).toHaveLength(0);
    expect(found.every((m) => m.is_bookmarked === undefined)).toBe(true);
  });
});
