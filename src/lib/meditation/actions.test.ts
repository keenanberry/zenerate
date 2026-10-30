import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockUpdate, mockRead, filters } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdate: vi.fn(),
  mockRead: vi.fn(),
  filters: [] as [string, unknown][],
}));

// update().eq().eq().select() resolves through mockUpdate, which sees the
// values written; the filters it was scoped by land in `filters`. A read,
// select().eq()...maybeSingle(), resolves through mockRead.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => {
        const chain = { eq: () => chain, maybeSingle: () => mockRead() };
        return chain;
      },
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

import { updateMeditation, updateMeditationDetails } from "./actions";

const USER = "user-1";

beforeEach(() => {
  filters.length = 0;
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: USER } } });
  mockUpdate.mockReset().mockResolvedValue({ data: [{ id: "med-1" }], error: null });
  mockRead.mockReset().mockResolvedValue({
    data: { status: "completed", audio_path: `${USER}/med-1/r.mp3` },
    error: null,
  });
});

describe("updateMeditation", () => {
  it("publishes a meditation whose audio is made, scoped to the owner", async () => {
    await updateMeditation("med-1", { is_public: true });

    const values = mockUpdate.mock.calls[0][0];
    expect(values.is_public).toBe(true);
    expect(Object.keys(values).sort()).toEqual(["is_public", "updated_at"]);
    expect(filters).toEqual([
      ["id", "med-1"],
      ["user_id", USER],
    ]);
  });

  it("unpublishes whatever the meditation's state", async () => {
    mockRead.mockResolvedValue({ data: { status: "script_ready", audio_path: null }, error: null });
    await updateMeditation("med-1", { is_public: false });
    expect(mockUpdate.mock.calls[0][0].is_public).toBe(false);
  });

  it.each([
    ["no audio", { status: "completed", audio_path: null }],
    ["a status short of completed", { status: "script_ready", audio_path: "x" }],
  ])("refuses to publish a meditation with %s", async (_, row) => {
    mockRead.mockResolvedValue({ data: row, error: null });
    await expect(updateMeditation("med-1", { is_public: true })).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["audio_path", { audio_path: "x" }],
    ["script", { script: "x" }],
    ["status", { status: "completed" }],
    ["is_public alongside another column", { is_public: true, is_featured: true }],
    ["a non-boolean is_public", { is_public: "true" }],
  ])("rejects %s", async (_, data) => {
    await expect(
      updateMeditation("med-1", data as unknown as { is_public: boolean }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses someone else's meditation", async () => {
    mockRead.mockResolvedValue({ data: null, error: null });
    await expect(updateMeditation("med-1", { is_public: false })).rejects.toThrow("Meditation not found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
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
