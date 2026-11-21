import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/profile/profile";

// A save refreshes the route so the (app) layout's avatar picks up the name.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { ProfileForm } = await import("./profile-form");

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

  it("with a photo: Change photo and Remove", () => {
    const html = render({ ...NEW_ACCOUNT, avatar_url: "https://example.com/a.png" });
    expect(html).toContain("Change photo");
    expect(html).toContain(">Remove<");
    expect(html).not.toContain("Add photo");
  });
});
