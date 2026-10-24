import Link from "next/link";
import { NewChatForm } from "@/components/studio/new-chat-form";
import { listDraftChats } from "@/lib/chat/actions";

export const metadata = {
  title: "Create Meditation | Zenerate",
};

export default async function CreatePage() {
  // A chat created but never sent to has no title, and nothing to return to.
  const drafts = (await listDraftChats()).filter((chat) => chat.title);

  return (
    // One request in a sentence or two, so a narrow column.
    <div className="mx-auto max-w-2xl space-y-14">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-[1.15] font-medium tracking-[-0.01em] text-balance">
            What meditation would you like?
          </h1>
          <p className="max-w-[60ch] text-muted-foreground">
            Say it in a sentence: what it is for, and how long. The script is
            written as you watch, and you change it by asking.
          </p>
        </div>
        <NewChatForm />
      </div>

      {drafts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Recent
          </h2>
          <ul className="divide-y border-y">
            {drafts.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/create/${chat.id}`}
                  className="flex items-baseline justify-between gap-4 py-3.5 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="truncate font-serif text-base">{chat.title}</span>
                  <time
                    dateTime={chat.updated_at}
                    className="shrink-0 text-sm text-muted-foreground tabular-nums"
                  >
                    {new Date(chat.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
