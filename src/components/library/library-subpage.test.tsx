import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibrarySubpage } from "./library-subpage";

describe("LibrarySubpage", () => {
  it("links back to the Library and names itself for meditations opened from it", () => {
    const html = renderToStaticMarkup(
      <LibrarySubpage title="Favorites" backLabel="Favorites" toolbar={<button>toggle</button>}>
        <p>list</p>
      </LibrarySubpage>,
    );
    expect(html).toMatch(/^<div data-back-label="Favorites">/);
    expect(html).toMatch(/<a [^>]*href="\/library"[^>]*>.*Library<\/a>/);
    expect(html).toContain("<h1");
    expect(html).toContain("Favorites</h1>");
    expect(html).toContain("<button>toggle</button>");
    expect(html).toContain("<p>list</p>");
  });
});
