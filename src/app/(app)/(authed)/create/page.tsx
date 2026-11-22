import { NewChatForm } from "@/components/studio/new-chat-form";
import { DraftChatList } from "@/components/studio/draft-chat-list";
import { listDraftChats } from "@/lib/chat/actions";
import { AccountAvatarLink } from "@/components/account-avatar-link";
import { initials } from "@/lib/navigation/app-tabs";
import { getViewer } from "@/lib/profile/viewer";

export const metadata = {
  title: "Create Meditation | Zenerate",
};

export default async function CreatePage() {
  // getViewer is the (app) layout's own read, shared through React's cache.
  const [chats, { user, displayName, avatarUrl }] = await Promise.all([listDraftChats(), getViewer()]);
  // A chat created but never sent to has no title, and nothing to return to.
  const drafts = chats.filter((chat) => chat.title);

  return (
    // One request in a sentence or two, so a narrow column.
    <div className="mx-auto max-w-2xl space-y-14">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-[1.15] font-medium tracking-[-0.01em] text-balance">
              What meditation would you like?
            </h1>
            {/* The phone's way to Account; from md it is in the top bar. The
                question stays the title, so no "Create" heading beside it. */}
            {user && (
              <AccountAvatarLink
                initials={initials(displayName, user.email ?? null)}
                avatarUrl={avatarUrl}
                className="md:hidden"
              />
            )}
          </div>
          <p className="max-w-[60ch] text-muted-foreground">
            Say it in a sentence: what it is for, and how long. The script is
            written as you watch, and you change it by asking.
          </p>
        </div>
        <NewChatForm />
      </div>

      {drafts.length > 0 && <DraftChatList chats={drafts} />}
    </div>
  );
}
