import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BookmarkPage } from "@/lib/meditation/bookmarks";

const { mockList, mockSign, mockCollections } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSign: vi.fn(),
  mockCollections: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/lib/profile/viewer", () => ({ getSessionUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/meditation/bookmarks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/meditation/bookmarks")>()),
  listBookmarks: mockList,
}));
vi.mock("@/lib/meditation/actions", () => ({
  signBookmarkAudio: mockSign,
  getUserCollections: mockCollections,
  deleteCollection: vi.fn(),
  updateCollection: vi.fn(),
}));

import BookmarksPage from "./bookmarks/page";
import CollectionsPage from "./collections/page";

const render = async (page: Promise<React.ReactElement>) =>
  renderToStaticMarkup(<TooltipProvider>{await page}</TooltipProvider>);

const TOGGLE = 'role="group" aria-label="View"';

const page: BookmarkPage = {
  bookmarks: [
    {
      bookmarked_at: "2026-11-20T12:00:00Z",
      meditation: {
        id: "m1",
        title: "Before Sleep",
        description: null,
        tags: ["sleep"],
        settings: { duration: 10 },
        status: "completed",
        created_at: "2026-11-01T12:00:00Z",
        cover_path: null,
        cover_url: null,
        author: null,
        rating: null,
      },
    },
  ],
  next_cursor: null,
};

beforeEach(() => {
  mockList.mockReset().mockResolvedValue(page);
  mockSign.mockReset().mockImplementation(async (p: BookmarkPage) => ({
    ...p,
    bookmarks: p.bookmarks.map((b) => ({ ...b, meditation: { ...b.meditation, audio_url: "signed:m1" } })),
  }));
  mockCollections.mockReset().mockResolvedValue([
    {
      id: "c1",
      user_id: "u1",
      name: "Wind down",
      description: null,
      created_at: "2026-11-01T12:00:00Z",
      updated_at: "2026-11-01T12:00:00Z",
      item_count: 2,
      covers: [],
    },
  ]);
});

describe("/library/bookmarks", () => {
  it("offers the list/grid toggle and draws the signed list by default", async () => {
    const html = await render(BookmarksPage());
    expect(html).toContain(TOGGLE);
    expect(html).toContain('aria-label="List view" aria-pressed="true"');
    expect(mockSign).toHaveBeenCalledWith(page);
    expect(html).toContain('aria-label="Play Before Sleep"');
  });

  it("has no toggle with nothing saved", async () => {
    mockList.mockResolvedValue({ bookmarks: [], next_cursor: null });
    const html = await render(BookmarksPage());
    expect(html).not.toContain(TOGGLE);
    expect(html).toContain("Nothing saved yet");
  });
});

describe("/library/collections", () => {
  it("offers the list/grid toggle and draws the grid by default", async () => {
    const html = await render(CollectionsPage());
    expect(html).toContain(TOGGLE);
    expect(html).toContain('aria-label="Grid view" aria-pressed="true"');
    expect(html).toContain("grid-cols-2");
    expect(html).toContain('href="/collections/c1"');
  });

  it("has no toggle with no collections", async () => {
    mockCollections.mockResolvedValue([]);
    const html = await render(CollectionsPage());
    expect(html).not.toContain(TOGGLE);
    expect(html).toContain("No collections yet.");
  });
});
