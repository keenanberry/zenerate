import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/profile/profile";

// A save refreshes the route so the (app) layout's avatar picks up the name.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { ProfileForm, ProfilePhoto } = await import("./profile-form");

const NEW_ACCOUNT: Profile = {
  id: "u1",
  display_name: null,
  avatar_url: null,
  bio: null,
  is_public: false,
  created_at: "2026-11-20T00:00:00Z",
  updated_at: "2026-11-20T00:00:00Z",
};

const render = (profile: Profile) =>
  renderToStaticMarkup(<ProfileForm profile={profile} email="ada@example.com" />);

describe("ProfileForm", () => {
  it("shows a new account's public switch off, with nothing to save yet", () => {
    const html = render(NEW_ACCOUNT);
    expect(html).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="false"[^>]*id="is_public"/);
    expect(html).toMatch(/type="submit" disabled=""/);
  });

  it("fills the fields from the saved profile", () => {
    const html = render({
      ...NEW_ACCOUNT,
      display_name: "Ada",
      bio: "Breathwork teacher.",
      avatar_url: "https://example.com/a.png",
      is_public: true,
    });
    expect(html).toContain('value="Ada"');
    expect(html).toContain(">Breathwork teacher.</textarea>");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
  });

  it("has no avatar URL text box: the photo is picked from the device", () => {
    const html = render(NEW_ACCOUNT);
    expect(html).not.toContain('id="avatar_url"');
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/\*"/);
  });

  it("with no photo: Add photo, and nothing to remove", () => {
    const html = render(NEW_ACCOUNT);
    expect(html).toContain("Add photo");
    expect(html).not.toContain("Change photo");
    expect(html).not.toContain(">Remove<");
  });

  it("with a photo: Change photo and Remove, which names what it removes", () => {
    const html = render({ ...NEW_ACCOUNT, avatar_url: "https://example.com/a.png" });
    expect(html).toContain("Change photo");
    expect(html).toContain(">Remove<");
    expect(html).toContain('aria-label="Remove photo"');
    expect(html).not.toContain("Add photo");
  });

  it("the photo buttons are never `disabled`, so focus stays on them while a photo saves", () => {
    const html = render({ ...NEW_ACCOUNT, avatar_url: "https://example.com/a.png" });
    const photoButtons = html.match(/<button[^>]*>(?:(?!<\/button>).)*(?:Change photo|Remove)<\/button>/g) ?? [];
    expect(photoButtons).toHaveLength(2);
    for (const button of photoButtons) expect(button).not.toMatch(/\sdisabled=""/);
  });
});

// Radix's Avatar keeps an unmounted image's "loaded" state, so after Remove a
// reused Avatar showed an empty circle instead of the initial (fixed in
// a11700f). The fix is a fresh Avatar per photo, by key. This repo's tests run
// without a DOM, so this checks the key the fix depends on.
describe("ProfilePhoto", () => {
  const photo = (url: string | null) =>
    ProfilePhoto({ url, initial: "A", dim: false }) as React.ReactElement;

  it("is a new Avatar when the photo is removed or replaced, so the initial can return", () => {
    const withPhoto = photo("https://example.com/a.webp");
    const removed = photo(null);
    const replaced = photo("https://example.com/b.webp");
    expect(withPhoto.key).not.toBeNull();
    expect(new Set([withPhoto.key, removed.key, replaced.key]).size).toBe(3);
    expect(photo("https://example.com/a.webp").key).toBe(withPhoto.key);
  });

  it("with no photo, renders the initial", () => {
    const html = renderToStaticMarkup(<ProfilePhoto url={null} initial="A" dim={false} />);
    expect(html).toContain(">A</span>");
    expect(html).not.toContain("<img");
  });
});
