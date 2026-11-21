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
    expect(html).toContain('value="https://example.com/a.png"');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
  });
});
