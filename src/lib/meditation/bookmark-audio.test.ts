import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHydrate } = vi.hoisted(() => ({ mockHydrate: vi.fn() }));

// The signer itself (the public lookup, the batch signature) is tested in
// src/lib/audio/signed-url.test.ts. Here: what the bookmark read hands it,
// and what the read does when it fails.
vi.mock("@/lib/audio/signed-url", () => ({ hydrateAudioUrls: mockHydrate }));

import { signBookmarkAudioUrls, withBookmarkAudio } from "./bookmark-audio";
import { MAX_BOOKMARK_PAGE, type Bookmark } from "./bookmarks";

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

beforeEach(() => {
  mockHydrate
    .mockReset()
    .mockImplementation(async (rows: { id: string }[]) =>
      rows.map((r) => ({ ...r, audio_url: r.id === "b" ? null : `signed:${r.id}` })),
    );
});

describe("withBookmarkAudio", () => {
  it("signs every row by its id alone, on the public-row path, and keeps the page's order and cursor", async () => {
    const page = await withBookmarkAudio("user-1", { bookmarks: [bookmark("a"), bookmark("b")], next_cursor: "next" });

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

  it("when signing throws, logs it and returns the page with no audio, so rows open the page to play", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockHydrate.mockRejectedValue(new Error("SUPABASE_SERVICE_ROLE_KEY is not set"));

    const page = await withBookmarkAudio("user-1", { bookmarks: [bookmark("a"), bookmark("c")], next_cursor: null });

    expect(page.bookmarks.map((b) => [b.meditation.id, b.meditation.audio_url])).toEqual([
      ["a", null],
      ["c", null],
    ]);
    expect(log).toHaveBeenCalledWith("Could not sign bookmark audio:", expect.any(Error));
    log.mockRestore();
  });
});

describe("signBookmarkAudioUrls", () => {
  it(`signs at most ${MAX_BOOKMARK_PAGE} ids, the largest page; the rest get null`, async () => {
    const ids = Array.from({ length: MAX_BOOKMARK_PAGE + 5 }, (_, i) => `m${i}`);

    const urls = await signBookmarkAudioUrls("user-1", ids);

    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(mockHydrate.mock.calls[0][0]).toHaveLength(MAX_BOOKMARK_PAGE);
    expect(mockHydrate.mock.calls[0][0][0]).toEqual({ id: "m0" });
    expect(urls.size).toBe(ids.length);
    expect(urls.get(`m${MAX_BOOKMARK_PAGE - 1}`)).toBe(`signed:m${MAX_BOOKMARK_PAGE - 1}`);
    expect(urls.get(`m${MAX_BOOKMARK_PAGE}`)).toBeNull();
  });

  it("counts a repeated id once toward the cap", async () => {
    await signBookmarkAudioUrls("user-1", ["a", "a", "c"]);
    expect(mockHydrate).toHaveBeenCalledWith([{ id: "a" }, { id: "c" }]);
  });

  it("signs nothing without the caller's user id, or with no ids", async () => {
    expect([...(await signBookmarkAudioUrls("", ["a"])).values()]).toEqual([null]);
    expect((await signBookmarkAudioUrls("user-1", [])).size).toBe(0);
    expect(mockHydrate).not.toHaveBeenCalled();
  });
});
