import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibraryRows } from "./library-rows";
import { RecentlyPlayed } from "./recently-played";

/** Each link's href and its visible text, in order. */
function links(html: string) {
  return [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map(([, attrs, inner]) => ({
    href: /href="([^"]*)"/.exec(attrs)?.[1],
    text: inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }));
}

describe("LibraryRows", () => {
  it("links the four places in order, each with its count, zero included", () => {
    const html = renderToStaticMarkup(
      <LibraryRows counts={{ favorites: 12, bookmarks: 0, meditations: 8, collections: 3 }} />,
    );
    expect(links(html)).toEqual([
      { href: "/library/favorites", text: "Favorites 12" },
      { href: "/library/bookmarks", text: "Bookmarks 0" },
      { href: "/library/meditations", text: "My meditations 8" },
      { href: "/library/collections", text: "Collections 3" },
    ]);
  });

  it("rows are at least 52px tall, and a count that could not be read is left out", () => {
    const html = renderToStaticMarkup(
      <LibraryRows counts={{ favorites: 1, bookmarks: null, meditations: 2, collections: 3 }} />,
    );
    expect(html).toContain("min-h-13");
    expect(links(html)[1]).toEqual({ href: "/library/bookmarks", text: "Bookmarks" });
  });
});

describe("RecentlyPlayed", () => {
  const item = (id: string, source: "yours" | "discover", duration?: number) => ({
    id,
    title: `Title ${id}`,
    tags: [],
    settings: duration ? { duration } : {},
    status: "completed" as const,
    source,
  });

  it("draws a tile per meditation with its length and where it came from", () => {
    const html = renderToStaticMarkup(
      <RecentlyPlayed items={[item("a", "yours", 10), item("b", "discover")]} />,
    );
    expect(html).toContain("Recently played");
    expect(html).toContain('href="/meditation/a"');
    expect(html).toContain("10 min · Yours");
    expect(html).toContain("Discover");
    expect(html).toContain("grid-cols-2");
  });

  it("with nothing played, offers to make a first meditation or browse Discover", () => {
    const html = renderToStaticMarkup(<RecentlyPlayed items={[]} />);
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/discover"');
    expect(html).not.toContain("/meditation/");
  });
});
