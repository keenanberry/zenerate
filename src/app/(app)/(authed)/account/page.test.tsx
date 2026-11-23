import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
  useRouter: () => ({ back: () => {} }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "ada@example.com" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "u1" }, error: null }) }) }),
    }),
  }),
}));
vi.mock("@/components/profile-form", () => ({ ProfileForm: () => <form /> }));
vi.mock("@/components/theme-choice", () => ({ ThemeChoice: () => <div /> }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => <button /> }));

const { default: AccountPage } = await import("./page");

describe("AccountPage", () => {
  it("opens with a back link on a phone, to the Library when there is no page to go back to", async () => {
    const html = renderToStaticMarkup(await AccountPage());
    const back = /<a [^>]*aria-label="Back"[^>]*>/.exec(html)?.[0] ?? "";
    expect(back).toContain('href="/library"');
    expect(back).toContain("md:hidden");
    // Before the title.
    expect(html.indexOf('aria-label="Back"')).toBeLessThan(html.indexOf(">Account</h1>"));
  });

  it("always offers Install the app, so dismissing the Library card is never a dead end", async () => {
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain("Install the app");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>.*Install the app/);
    // Both lines are in the server's markup and CSS picks one, so hydrating
    // in the installed app changes nothing.
    expect(html).toMatch(/class="[^"]*block standalone:hidden[^"]*">Add Zenerate to your home screen/);
    expect(html).toMatch(/class="[^"]*hidden standalone:block[^"]*">Installed on this device/);
  });
});
