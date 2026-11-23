import { describe, expect, it, vi } from "vitest";

const { mockHydrate } = vi.hoisted(() => ({ mockHydrate: vi.fn() }));

// The signer itself (the public lookup, the batch signature) is tested in
// src/lib/audio/signed-url.test.ts. Here: what the bookmark read hands it.
vi.mock("@/lib/audio/signed-url", () => ({
  hydrateAudioUrl: vi.fn(),
  hydrateAudioUrls: mockHydrate,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { signBookmarkAudio } from "./actions";
import type { Bookmark } from "./bookmarks";

function bookmark(id: string): Bookmark {
  return {
    bookmarked_at: "2026-11-20T12:00:00Z",
    meditation: {
      id,
      title: `Title ${id}`,
      description: null,
      tags: null,
      settings: null,
      status: "completed",
      created_at: "2026-11-01T12:00:00Z",
      cover_path: null,
      cover_url: null,
      author: null,
      rating: null,
    },
  };
}

describe("signBookmarkAudio", () => {
  it("signs every row by its id alone, on the public-row path, and keeps the page's order and cursor", async () => {
    mockHydrate.mockImplementation(async (rows: { id: string }[]) =>
      rows.map((r) => ({ ...r, audio_url: r.id === "b" ? null : `signed:${r.id}` })),
    );

    const page = await signBookmarkAudio({ bookmarks: [bookmark("a"), bookmark("b")], next_cursor: "next" });

    // No audio_path on the row: the service role looks the meditation up and
    // signs it only if public, and the path never joins the row.
    expect(mockHydrate).toHaveBeenCalledWith([{ id: "a" }, { id: "b" }]);
    expect(page.next_cursor).toBe("next");
    expect(page.bookmarks.map((b) => [b.meditation.id, b.meditation.audio_url])).toEqual([
      ["a", "signed:a"],
      ["b", null],
    ]);
    expect(page.bookmarks[0].meditation.title).toBe("Title a");
    expect(page.bookmarks[0].meditation).not.toHaveProperty("audio_path");
  });
});
