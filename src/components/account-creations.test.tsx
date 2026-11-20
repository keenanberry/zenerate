import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { AccountCreations, creationsSummary } = await import("./account-creations");

const meditations = [
  { id: "m1", title: "Rain & Release", is_public: true, created_at: "2026-11-02T12:00:00Z" },
  { id: "m2", title: "Before Sleep", is_public: false, created_at: "2026-11-01T12:00:00Z" },
];
const chats = [{ id: "c1", title: "A walk by the sea", updated_at: "2026-11-03T12:00:00Z" }];

function render(props: Partial<Parameters<typeof AccountCreations>[0]> = {}) {
  return renderToStaticMarkup(
    <AccountCreations
      meditations={meditations}
      chats={chats}
      empty={<p>Nothing yet</p>}
      defaultOpen
      {...props}
    />,
  );
}

describe("AccountCreations", () => {
  it("lists each meditation with its visibility and each chat, linked to its page", () => {
    const html = render();
    expect(html).toContain('href="/meditation/m1"');
    expect(html).toContain('href="/create/c1"');
    expect(html).toMatch(/Rain &amp; Release.*Public ·/);
    expect(html).toMatch(/Before Sleep.*Private ·/);
    expect(html).toContain("Updated ");
    expect(html).not.toContain("Nothing yet");
  });

  it("gives every row a Delete named for it", () => {
    const html = render();
    for (const title of ["Rain &amp; Release", "Before Sleep", "A walk by the sea"]) {
      expect(html).toContain(`aria-label="Delete ${title}"`);
    }
  });

  it("leaves out a heading with nothing under it, and shows the empty state when both are empty", () => {
    expect(render({ chats: [] })).not.toContain("Studio chats");
    expect(render({ meditations: [] })).not.toContain(">Meditations<");
    expect(render({ meditations: [], chats: [] })).toBe("<p>Nothing yet</p>");
  });

  it("starts closed behind a Show row that counts what it holds", () => {
    const html = render({ defaultOpen: undefined });
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/Show.*2 meditations · 1 chat/);
    expect(html).not.toContain('href="/meditation/m1"');
    expect(html).not.toContain('href="/create/c1"');
  });

  it("shows the empty state, not a Show row, when there is nothing to list", () => {
    expect(render({ defaultOpen: undefined, meditations: [], chats: [] })).toBe(
      "<p>Nothing yet</p>",
    );
  });
});

describe("creationsSummary", () => {
  it("counts each kind, singular or plural, and leaves out a kind with none", () => {
    expect(creationsSummary(2, 1)).toBe("2 meditations · 1 chat");
    expect(creationsSummary(1, 3)).toBe("1 meditation · 3 chats");
    expect(creationsSummary(0, 2)).toBe("2 chats");
    expect(creationsSummary(4, 0)).toBe("4 meditations");
  });
});
