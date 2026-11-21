import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { BottomBar } = await import("./bottom-bar");

/** Each link's text and whether it is marked as the current page, in order. */
function links(html: string) {
  return [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map(([, attrs, inner]) => ({
    href: /href="([^"]*)"/.exec(attrs)?.[1],
    label: inner.replace(/<[^>]+>/g, "").trim(),
    current: attrs.includes('aria-current="page"'),
  }));
}

describe("BottomBar", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("links Library, Discover and Create in order, marking the Library on its sub-page", () => {
    pathname = "/library/favorites";
    const html = renderToStaticMarkup(<BottomBar />);
    expect(html).toContain('aria-label="Primary"');
    expect(links(html)).toEqual([
      { href: "/library", label: "Library", current: true },
      { href: "/discover", label: "Discover", current: false },
      { href: "/create", label: "Create", current: false },
    ]);
  });

  it("marks no tab on Account", () => {
    pathname = "/account";
    expect(links(renderToStaticMarkup(<BottomBar />)).some((l) => l.current)).toBe(false);
  });

  it("renders nothing in the studio", () => {
    pathname = "/create/abc";
    expect(renderToStaticMarkup(<BottomBar />)).toBe("");
  });
});
