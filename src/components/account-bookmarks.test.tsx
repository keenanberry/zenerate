import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Bookmark } from "@/lib/meditation/bookmarks";
import { AccountBookmarks } from "./account-bookmarks";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

function bookmark(id: string, title: string, extra: Partial<Bookmark["meditation"]> = {}): Bookmark {
  return {
    bookmarked_at: "2026-11-20T12:00:00Z",
    meditation: {
      id,
      title,
      description: null,
      tags: ["sleep"],
      settings: { duration: 10 },
      status: "completed",
      created_at: "2026-11-01T12:00:00Z",
      author: null,
      rating: null,
      ...extra,
    },
  };
}

function render(bookmarks: Bookmark[], next_cursor: string | null = null) {
  return renderToStaticMarkup(
    <TooltipProvider>
      <AccountBookmarks initial={{ bookmarks, next_cursor }} empty={<p>Nothing saved</p>} />
    </TooltipProvider>,
  );
}

describe("AccountBookmarks", () => {
  it("lists them as Favorites' track rows, in the order given, each linked to its page, with remove and no play", () => {
    const html = render([
      bookmark("m2", "Rain & Release", {
        author: { id: "u1", display_name: "Alice", avatar_url: null },
        rating: { average: 4.5, count: 2 },
      }),
      bookmark("m1", "Before Sleep"),
    ]);
    expect(html.indexOf("Rain &amp; Release")).toBeLessThan(html.indexOf("Before Sleep"));
    expect(html).toContain('href="/meditation/m2"');
    expect(html).toContain('href="/meditation/m1"');
    expect(html).not.toMatch(/aria-label="Play /);
    expect(html).toContain('aria-label="Remove Rain &amp; Release from saved"');
    expect(html).toContain('aria-label="Remove Before Sleep from saved"');
    // No heart: the bookmark read does not say what is favourited.
    expect(html).not.toMatch(/aria-label="(Add|Remove) [^"]* (to|from) favorites"/);
    // The author leads the meta line; without one, it starts at the tag.
    expect(html).toMatch(/>Alice · Sleep · 10 min · /);
    expect(html).toMatch(/>Sleep · 10 min · /);
    expect(html).toContain(">4.5<");
    expect(html).not.toContain("(2)");
    expect(html).not.toContain("Nothing saved");
    expect(html).not.toContain("Load more");
  });

  it("offers Load more while there is a next page", () => {
    expect(render([bookmark("m1", "Before Sleep")], "cursor")).toContain("Load more");
  });

  it("shows the empty state when there are none", () => {
    expect(render([])).toBe("<p>Nothing saved</p>");
  });
});
