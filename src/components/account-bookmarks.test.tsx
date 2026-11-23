import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Bookmark } from "@/lib/meditation/bookmarks";
import { AccountBookmarks, appendBookmarks } from "./account-bookmarks";
import { ViewProvider } from "./view-context";

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
      cover_path: null,
      cover_url: null,
      author: null,
      rating: null,
      ...extra,
    },
  };
}

function render(
  bookmarks: Bookmark[],
  next_cursor: string | null = null,
  view: "list" | "grid" = "list",
) {
  // The server's render: ViewProvider draws its default until hydrated.
  return renderToStaticMarkup(
    <TooltipProvider>
      <ViewProvider defaultView={view} storageKey="test:bookmarks">
        <AccountBookmarks initial={{ bookmarks, next_cursor }} empty={<p>Nothing saved</p>} />
      </ViewProvider>
    </TooltipProvider>,
  );
}

const signed = (id: string) => `https://abc.supabase.co/storage/v1/object/sign/meditation-audio/${id}.mp3?token=t`;

describe("AccountBookmarks", () => {
  it("lists them as Favorites' track rows, in the order given, each linked to its page, with play from sm and remove", () => {
    const html = render([
      bookmark("m2", "Rain & Release", {
        author: { id: "u1", display_name: "Alice", avatar_url: null },
        rating: { average: 4.5, count: 2 },
        audio_url: signed("m2"),
      }),
      bookmark("m1", "Before Sleep", { audio_url: signed("m1") }),
    ]);
    expect(html.indexOf("Rain &amp; Release")).toBeLessThan(html.indexOf("Before Sleep"));
    expect(html).toContain('href="/meditation/m2"');
    expect(html).toContain('href="/meditation/m1"');
    // The index column, as Favorites': from sm, the row number, which plays
    // the signed audio in place.
    expect(html.match(/<button type="button" aria-label="Play [^"]*" class="[^"]*hidden sm:flex/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Play Rain &amp; Release"');
    expect(html).toContain('aria-label="Play Before Sleep"');
    expect(html).toMatch(/>1</);
    expect(html).toMatch(/>2</);
    // Rendering the rows downloads nothing: no <audio>, no preload.
    expect(html).not.toContain("<audio");
    expect(html).not.toContain(signed("m1"));
    expect(html).toContain('aria-label="Remove Rain &amp; Release from saved"');
    expect(html).toContain('aria-label="Remove Before Sleep from saved"');
    // No heart: the bookmark read does not say what is favourited.
    expect(html).not.toMatch(/aria-label="(Add|Remove) [^"]* (to|from) favorites"/);
    // The author leads the meta line; without one, it starts at the tag. No
    // date, which would not fit a phone.
    expect(html).toContain(">Alice · Sleep · 10 min<");
    expect(html).toContain(">Sleep · 10 min<");
    expect(html).not.toContain("Nov 1");
    expect(html).toContain(">4.5<");
    expect(html).not.toContain("(2)");
    expect(html).not.toContain("Nothing saved");
    expect(html).not.toContain("Load more");
  });

  it("draws a bookmark's generated cover, and the designed one without", () => {
    const cover = "https://abc.supabase.co/storage/v1/object/public/meditation-covers/a/x.webp";
    const html = render([
      bookmark("a", "With a cover", { cover_path: "a/x.webp", cover_url: cover }),
      bookmark("b", "Without"),
    ]);
    // A 56px row draws from the cover's thumbnail.
    expect(html).toContain(`src="${cover.replace(/\.webp$/, ".thumb.webp")}"`);
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html.match(/data-motif=/g)).toHaveLength(1);
  });

  it("without a signed URL, the index column says so rather than playing", () => {
    const html = render([bookmark("m1", "Before Sleep")]);
    expect(html).not.toMatch(/aria-label="Play /);
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("in the grid, draws tiles with the remove control beside the title and no heart", () => {
    const html = render(
      [
        bookmark("m2", "Rain & Release", {
          author: { id: "u1", display_name: "Alice", avatar_url: null },
          audio_url: signed("m2"),
        }),
        bookmark("m1", "Before Sleep", { audio_url: signed("m1") }),
      ],
      null,
      "grid",
    );
    expect(html).toContain("grid-cols-2");
    expect(html.indexOf("Rain &amp; Release")).toBeLessThan(html.indexOf("Before Sleep"));
    // MeditationCard: the title in Lora, no index column.
    expect(html.match(/font-serif/g)).toHaveLength(2);
    expect(html).not.toMatch(/>1</);
    expect(html).toContain(">Alice · Sleep · 10 min<");
    expect(html).toContain('aria-label="Remove Rain &amp; Release from saved"');
    expect(html).toContain('aria-label="Remove Before Sleep from saved"');
    expect(html).not.toMatch(/aria-label="(Add|Remove) [^"]* (to|from) favorites"/);
    expect(html).not.toContain("<audio");
  });

  it("offers Load more while there is a next page, in both views", () => {
    for (const view of ["list", "grid"] as const) {
      expect(render([bookmark("m1", "Before Sleep")], "cursor", view), view).toContain("Load more");
      expect(render([bookmark("m1", "Before Sleep")], null, view), view).not.toContain("Load more");
    }
  });

  it("Load more appends the next page after the list, less any already in it, and both views draw it", () => {
    const first = [bookmark("m3", "Three"), bookmark("m2", "Two")];
    const next = [bookmark("m2", "Two"), bookmark("m1", "One", { audio_url: signed("m1") })];
    const merged = appendBookmarks(first, next);
    expect(merged.map((b) => b.meditation.id)).toEqual(["m3", "m2", "m1"]);
    expect(merged[2].meditation.audio_url).toBe(signed("m1"));
    for (const view of ["list", "grid"] as const) {
      const html = render(merged, null, view);
      expect(html.match(/href="\/meditation\/m[123]"/g)?.length, view).toBeGreaterThanOrEqual(3);
      expect(html.indexOf("Three"), view).toBeLessThan(html.indexOf("One"));
    }
    expect(render(merged)).toContain('aria-label="Play One"');
  });

  it("shows the empty state when there are none", () => {
    expect(render([])).toBe('<div tabindex="-1" class="outline-none"><p>Nothing saved</p></div>');
  });
});
