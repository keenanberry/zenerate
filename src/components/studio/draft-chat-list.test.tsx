import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Radix renders a closed menu's content nowhere, so render every part inline.
vi.mock("@/components/ui/responsive-menu", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    ResponsiveMenu: Pass,
    ResponsiveMenuTrigger: Pass,
    ResponsiveMenuContent: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
    ResponsiveMenuItem: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { DraftChatList } = await import("./draft-chat-list");

const chats = [
  { id: "c1", title: "Sleep after a long shift", updated_at: "2026-11-20T10:00:00Z" },
  { id: "c2", title: "Five minutes before a talk", updated_at: "2026-11-19T10:00:00Z" },
];

describe("DraftChatList", () => {
  const html = renderToStaticMarkup(<DraftChatList chats={chats} />);

  it("links each chat to its studio", () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/create/c1", "/create/c2"]);
  });

  it("gives each chat a menu named for it, holding Delete", () => {
    const labels = [...html.matchAll(/<button [^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["More for Sleep after a long shift", "More for Five minutes before a talk"]);
    expect([...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""))).toEqual([
      "Delete",
      "Delete",
    ]);
  });
});
