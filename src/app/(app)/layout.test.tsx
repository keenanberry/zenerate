import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The shell's own markup, with the client parts reduced to markers that show
// the props they were given.
let user: { id: string; email: string } | null = null;
let displayName: string | null = null;
let avatarUrl: string | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { display_name: displayName, avatar_url: avatarUrl }, error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/components/nav", () => ({
  Nav: (props: {
    isSignedIn: boolean;
    variant?: string;
    avatar?: { initials: string; avatarUrl?: string | null } | null;
  }) => (
    <header
      data-variant={props.variant}
      data-signed-in={String(props.isSignedIn)}
      data-initials={props.avatar?.initials ?? ""}
      data-avatar-url={props.avatar?.avatarUrl ?? ""}
    />
  ),
}));
vi.mock("@/components/bottom-bar", () => ({ BottomBar: () => <nav data-bottom-bar /> }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <footer /> }));

const { default: AppLayout } = await import("./layout");

async function render() {
  return renderToStaticMarkup(await AppLayout({ children: <p>page</p> }));
}

/** The class list of the shell's outermost element. */
function shellClasses(html: string): string[] {
  return (/^<div class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
}

const BAR_PADDING = "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]";

describe("AppLayout", () => {
  beforeEach(() => {
    user = null;
    displayName = null;
    avatarUrl = null;
  });

  it("signed in: the app top bar with the avatar, the bottom bar, and room for it", async () => {
    user = { id: "u1", email: "ada@example.com" };
    displayName = "Ada Lovelace";
    const html = await render();
    expect(html).toContain('data-variant="app"');
    expect(html).toContain('data-initials="AL"');
    expect(html).toContain("data-bottom-bar");
    const classes = shellClasses(html);
    expect(classes).toContain(BAR_PADDING);
    // Not from md, where the bar is hidden, nor in the studio, where it is gone.
    expect(classes).toContain("md:pb-0");
    expect(classes).toContain("has-[[data-studio]]:pb-0");
  });

  it("signed in with a photo: the top bar's avatar gets it", async () => {
    user = { id: "u1", email: "ada@example.com" };
    avatarUrl = "https://example.com/a.webp";
    expect(await render()).toContain('data-avatar-url="https://example.com/a.webp"');
  });

  it("signed in without a display name: the avatar falls back to the email", async () => {
    user = { id: "u1", email: "zed@example.com" };
    expect(await render()).toContain('data-initials="Z"');
  });

  it("signed out: no bottom bar and no padding for one", async () => {
    const html = await render();
    expect(html).toContain('data-signed-in="false"');
    expect(html).not.toContain("data-bottom-bar");
    expect(shellClasses(html)).not.toContain(BAR_PADDING);
  });
});
