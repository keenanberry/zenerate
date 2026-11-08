import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Radix renders a closed menu's content nowhere, so render every part inline
// and read the items and separators in order.
vi.mock("@/components/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
    DropdownMenuItem: ({ children, asChild }: { children?: ReactNode; asChild?: boolean }) => (
      <li>{asChild ? children : <span>{children}</span>}</li>
    ),
    DropdownMenuSeparator: () => <hr />,
  };
});
vi.mock("@/components/add-to-collection-dialog", () => ({
  AddToCollectionDialog: ({ anchor }: { anchor: ReactNode }) => <>{anchor}</>,
}));

const { MeditationMenu } = await import("./meditation-menu");

type Props = Parameters<typeof MeditationMenu>[0];

const base: Props = {
  meditationId: "abc-123",
  title: "Rain & Release",
  isSignedIn: false,
  isOwner: false,
  chatId: null,
  hasAudio: false,
  reportHref: "mailto:privacy@zeneratestudio.com",
  isPublic: true,
  siteUrl: "https://www.zeneratestudio.com/",
  onEdit: () => {},
  visibility: null,
};

/** The menu's items and separators, top to bottom: "Share", "—", "Report". */
function items(props: Partial<Props>): string[] {
  const html = renderToStaticMarkup(<MeditationMenu {...base} {...props} />);
  const list = html.slice(html.indexOf("<ul>"));
  return [...list.matchAll(/<li>(.*?)<\/li>|<hr\/>/g)].map((m) =>
    m[1] === undefined ? "—" : m[1].replace(/<[^>]+>/g, "").trim(),
  );
}

const visibility = (isPublic: boolean) => ({ isPublic, isPending: false, toggle: () => {} });

describe("MeditationMenu", () => {
  it("gives a signed-out visitor Share and Report", () => {
    expect(items({})).toEqual(["Share", "—", "Report"]);
  });

  it("puts Share with the visitor items, above Report", () => {
    expect(items({ isSignedIn: true, hasAudio: true })).toEqual([
      "Share",
      "Add to collection",
      "Download",
      "—",
      "Report",
    ]);
  });

  it("offers the owner Share while the meditation is public", () => {
    expect(
      items({
        isSignedIn: true,
        isOwner: true,
        hasAudio: true,
        reportHref: null,
        visibility: visibility(true),
      }),
    ).toEqual(["Edit details", "Make private", "—", "Share", "Add to collection", "Download"]);
  });

  it("hides Share from the owner while it is private, since the link would 404", () => {
    expect(
      items({
        isSignedIn: true,
        isOwner: true,
        hasAudio: true,
        reportHref: null,
        visibility: visibility(false),
      }),
    ).not.toContain("Share");
  });

  it("follows the owner's toggle over the server's last word", () => {
    const owner = { isSignedIn: true, isOwner: true, hasAudio: true, reportHref: null };
    expect(items({ ...owner, isPublic: true, visibility: visibility(false) })).not.toContain(
      "Share",
    );
    expect(items({ ...owner, isPublic: false, visibility: visibility(true) })).toContain("Share");
  });

  it("before there is audio, shows the owner Share only if it is already public", () => {
    const owner = { isSignedIn: true, isOwner: true, reportHref: null, visibility: null };
    expect(items({ ...owner, isPublic: false })).toEqual(["Edit details", "—", "Add to collection"]);
    expect(items({ ...owner, isPublic: true })).toEqual([
      "Edit details",
      "—",
      "Share",
      "Add to collection",
    ]);
  });
});
