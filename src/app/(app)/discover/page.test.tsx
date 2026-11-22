import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The page's own header, with its data and client parts reduced to markers.
let viewer: { user: { id: string; email: string } | null; displayName: string | null; avatarUrl: string | null };

vi.mock("@/lib/profile/viewer", () => ({ getViewer: async () => viewer }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: viewer.user } }) } }),
}));
vi.mock("@/lib/meditation/actions", () => ({
  getPickedForYou: async () => [],
  getPopularMeditations: async () => [],
  getPublicMeditations: async () => [],
}));
vi.mock("@/lib/meditation/ratings", () => ({ withRatingStats: async (_: unknown, lists: unknown[]) => lists }));
vi.mock("@/components/account-avatar-link", () => ({
  AccountAvatarLink: (props: { initials: string; avatarUrl?: string | null; className?: string }) => (
    <a data-avatar={props.initials} data-avatar-url={props.avatarUrl ?? ""} className={props.className} />
  ),
}));
vi.mock("./search", () => ({ DiscoverSearch: () => <form /> }));
vi.mock("./category-grid", () => ({ CategoryGrid: () => <div /> }));
vi.mock("./discover-row", () => ({ DiscoverRow: () => <section /> }));
vi.mock("./view-wrapper", () => ({ DiscoverViewWrapper: () => <div /> }));
vi.mock("@/components/meditation-list-view", () => ({ MeditationListView: () => <ul /> }));

const { default: DiscoverPage } = await import("./page");

async function render() {
  return renderToStaticMarkup(await DiscoverPage({ searchParams: Promise.resolve({}) }));
}

describe("DiscoverPage header", () => {
  beforeEach(() => {
    viewer = { user: null, displayName: null, avatarUrl: null };
  });

  it("signed in: the avatar to Account beside the title, on a phone only, with the photo", async () => {
    viewer = {
      user: { id: "u1", email: "ada@example.com" },
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/a.webp",
    };
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>Discover<\/h1><a data-avatar="AL" data-avatar-url="https:\/\/example.com\/a.webp" class="md:hidden"/);
  });

  it("signed out: no avatar (the top bar is there at every width)", async () => {
    const html = await render();
    expect(html).toContain(">Discover</h1>");
    expect(html).not.toContain("data-avatar");
  });
});
