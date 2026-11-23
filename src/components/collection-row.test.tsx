import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CollectionWithCount } from "@/lib/meditation/types";

vi.mock("@/lib/meditation/actions", () => ({ deleteCollection: vi.fn(), updateCollection: vi.fn() }));

import { CollectionListView } from "./collection-list-view";
import { CollectionRow } from "./collection-row";
import { ViewProvider } from "./view-context";

function collection(id: string, name: string, item_count: number, covers = 0): CollectionWithCount {
  return {
    id,
    user_id: "u1",
    name,
    description: "Evenings",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    item_count,
    covers: Array.from({ length: covers }, (_, i) => ({
      id: `m${i}`,
      title: `Cover ${i}`,
      tags: ["sleep"],
      cover_path: null,
      cover_url: null,
    })),
  } as CollectionWithCount;
}

describe("CollectionRow", () => {
  it("draws the artwork at 56px, the name, the count and the collection's menu, linked to the collection", () => {
    const html = renderToStaticMarkup(<CollectionRow collection={collection("c1", "Wind down", 3, 3)} />);
    expect(html).toContain('href="/collections/c1"');
    expect(html).toContain(">Wind down<");
    expect(html).toContain(">3 meditations<");
    // The count only: the description is the tile's, not the row's.
    expect(html).not.toContain("Evenings");
    // The mosaic, in a 56px box, from three covers drawn at its cells' size.
    expect(html).toContain('class="size-14 shrink-0"');
    expect(html.match(/data-motif=/g)).toHaveLength(3);
    expect(html).toContain('aria-label="More for Wind down"');
    // A track row's rhythm: the inset Hairline, the hover, the row-wide link.
    expect(html).toContain("border-t group-first:border-t-0");
    expect(html).toContain("sm:hover:bg-muted/50");
    expect(html).toContain("after:absolute after:inset-0");
    expect(html).not.toContain("shadow-");
  });

  it("says 1 meditation, and draws an empty collection's quiet cover", () => {
    expect(renderToStaticMarkup(<CollectionRow collection={collection("c2", "One", 1, 1)} />)).toContain(
      ">1 meditation<",
    );
    const empty = renderToStaticMarkup(<CollectionRow collection={collection("c3", "Empty", 0)} />);
    expect(empty).toContain(">0 meditations<");
    expect(empty.match(/data-motif=/g)).toHaveLength(1);
  });
});

describe("CollectionListView", () => {
  const collections = [collection("c1", "Wind down", 3), collection("c2", "Mornings", 1)];
  const render = (view: "grid" | "list") =>
    renderToStaticMarkup(
      <ViewProvider defaultView={view} storageKey="test:collections">
        <CollectionListView collections={collections} />
      </ViewProvider>,
    );

  it("draws the playlist tiles in the grid, with the description", () => {
    const html = render("grid");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("font-serif");
    expect(html).toContain("3 meditations · Evenings");
  });

  it("draws rows in the list, in order", () => {
    const html = render("list");
    expect(html).not.toContain("grid-cols-2");
    expect(html.match(/border-t group-first:border-t-0/g)).toHaveLength(2);
    expect(html.indexOf("Wind down")).toBeLessThan(html.indexOf("Mornings"));
  });
});
