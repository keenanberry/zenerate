import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockUpdate, filters } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdate: vi.fn(),
  filters: [] as [string, unknown][],
}));

// update().eq().eq().select() resolves through mockUpdate, which sees the
// values written; the filters it was scoped by land in `filters`.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      update: (values: unknown) => {
        const chain = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          },
          select: () => mockUpdate(values),
        };
        return chain;
      },
    }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { updateMeditationDetails } from "./actions";

const USER = "user-1";

beforeEach(() => {
  filters.length = 0;
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: USER } } });
  mockUpdate.mockReset().mockResolvedValue({ data: [{ id: "med-1" }], error: null });
});

describe("updateMeditationDetails", () => {
  it("writes a trimmed title, description and tags, scoped to the owner", async () => {
    await updateMeditationDetails("med-1", {
      title: "  Evening unwind ",
      description: " Let the day go. ",
      tags: ["sleep", "bedtime"],
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Evening unwind",
        description: "Let the day go.",
        tags: ["sleep", "bedtime"],
      }),
    );
    expect(filters).toEqual([
      ["id", "med-1"],
      ["user_id", USER],
    ]);
  });

  it("writes only the fields it was given", async () => {
    await updateMeditationDetails("med-1", { tags: [] });

    const values = mockUpdate.mock.calls[0][0];
    expect(values.tags).toEqual([]);
    expect(values).not.toHaveProperty("title");
    expect(values).not.toHaveProperty("description");
  });

  it("stores a cleared description as null", async () => {
    await updateMeditationDetails("med-1", { description: "   " });
    expect(mockUpdate.mock.calls[0][0].description).toBeNull();
  });

  it("rejects a tag outside the vocabulary", async () => {
    await expect(
      updateMeditationDetails("med-1", { tags: ["sleep", "vibes"] }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects more than 5 tags, and a repeated tag", async () => {
    await expect(
      updateMeditationDetails("med-1", {
        tags: ["sleep", "bedtime", "focus", "energy", "grief", "mantra"],
      }),
    ).rejects.toThrow();
    await expect(
      updateMeditationDetails("med-1", { tags: ["sleep", "sleep"] }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty title", async () => {
    await expect(updateMeditationDetails("med-1", { title: "  " })).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects another user's meditation", async () => {
    // RLS and the user_id filter both leave someone else's row untouched,
    // so the update matches nothing.
    mockUpdate.mockResolvedValue({ data: [], error: null });

    await expect(
      updateMeditationDetails("med-other", { title: "Mine now" }),
    ).rejects.toThrow(/not found/i);
    expect(filters).toContainEqual(["user_id", USER]);
  });

  it("rejects a signed-out caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(updateMeditationDetails("med-1", { title: "Hi" })).rejects.toThrow(
      /not authenticated/i,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
