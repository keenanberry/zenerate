import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/library", useRouter: () => ({}) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: () => {}, resolvedTheme: "dark" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const { Nav } = await import("./nav");

/** The class list of the bar's outermost element. */
function headerClasses(html: string): string[] {
  return (/^<header class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
}

describe("Nav", () => {
  it("app, signed in: nothing below md, the sections and the avatar from md", () => {
    const html = renderToStaticMarkup(
      <Nav isSignedIn variant="app" avatar={{ initials: "AL", avatarUrl: null }} />,
    );
    const classes = headerClasses(html);
    // The whole bar is hidden below md: no wordmark-only strip on a phone.
    expect(classes).toContain("hidden");
    expect(classes).toContain("md:block");
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('aria-label="Account"');
    expect(html).not.toContain("Sign out");
  });

  it("app, signed out: the full site bar at every width", () => {
    const html = renderToStaticMarkup(<Nav isSignedIn={false} variant="app" />);
    const classes = headerClasses(html);
    expect(classes).not.toContain("hidden");
    expect(html).toContain("zenerate");
    expect(html).toContain('href="/discover"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("Toggle theme");
  });

  it("site, signed in: the full bar at every width", () => {
    const html = renderToStaticMarkup(<Nav isSignedIn variant="site" />);
    expect(headerClasses(html)).not.toContain("hidden");
    expect(html).toContain("Sign out");
  });
});
