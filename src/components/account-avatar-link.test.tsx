import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let pathname = "/library";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { AccountAvatarLink } = await import("./account-avatar-link");

describe("AccountAvatarLink", () => {
  it("without a photo: the initials in the chip, named Account", () => {
    pathname = "/library";
    const html = renderToStaticMarkup(<AccountAvatarLink initials="AL" />);
    expect(html).toMatch(/^<a [^>]*aria-label="Account"/);
    expect(html).toContain('href="/account"');
    expect(html).toContain('<span aria-hidden="true">AL</span>');
    expect(html).not.toContain('data-slot="avatar"');
  });

  it("with a photo: an avatar inside the same chip, the initials its fallback until it loads", () => {
    pathname = "/library";
    const html = renderToStaticMarkup(
      <AccountAvatarLink initials="AL" avatarUrl="https://example.com/a.webp" className="md:hidden" />,
    );
    expect(html).toMatch(/<a[^>]*aria-label="Account"[^>]*class="[^"]*size-10[^"]*rounded-full[^"]*md:hidden/);
    expect(html).toContain('data-slot="avatar"');
    // Radix shows the image only once it has loaded in the browser.
    expect(html).toContain(">AL<");
  });

  it("on Account: marked current", () => {
    pathname = "/account";
    const html = renderToStaticMarkup(<AccountAvatarLink initials="AL" avatarUrl="https://example.com/a.webp" />);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("border-primary");
  });
});
