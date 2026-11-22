import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile/viewer", () => ({
  getViewer: async () => ({
    user: { id: "u1", email: "zed@example.com" },
    displayName: null,
    avatarUrl: "https://example.com/z.webp",
  }),
}));
vi.mock("@/lib/chat/actions", () => ({ listDraftChats: async () => [] }));
vi.mock("@/components/studio/new-chat-form", () => ({ NewChatForm: () => <form /> }));
vi.mock("@/components/studio/draft-chat-list", () => ({ DraftChatList: () => <ul /> }));
vi.mock("@/components/account-avatar-link", () => ({
  AccountAvatarLink: (props: { initials: string; avatarUrl?: string | null; className?: string }) => (
    <a data-avatar={props.initials} data-avatar-url={props.avatarUrl ?? ""} className={props.className} />
  ),
}));

const { default: CreatePage } = await import("./page");

describe("CreatePage header", () => {
  it("the question stays the title, with the avatar to Account at its right on a phone", async () => {
    const html = renderToStaticMarkup(await CreatePage());
    expect(html).toMatch(
      /What meditation would you like\?\s*<\/h1><a data-avatar="Z" data-avatar-url="https:\/\/example.com\/z.webp" class="md:hidden"/,
    );
    expect(html).not.toMatch(/>Create<\/h1>/);
  });
});
