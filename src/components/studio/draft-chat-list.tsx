"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheetHeader } from "@/components/ui/bottom-sheet";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/components/ui/responsive-menu";
import { DeleteDialog, type Deletable } from "@/components/delete-dialog";
import type { Chat } from "@/lib/meditation/types";

/**
 * Create's "Recent": the studio chats that have no script yet, each a link
 * back into its studio with a "…" holding Delete. A chat that made a
 * meditation is reached through that meditation's "Continue in chat"; when
 * the meditation is deleted its chat turns back into a draft and lists here.
 * A deleted row leaves the list at once; the refresh brings the server's word.
 */
export function DraftChatList({
  chats,
}: {
  chats: Pick<Chat, "id" | "title" | "updated_at">[];
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<Deletable | null>(null);

  const shown = chats.filter((chat) => !removed.has(chat.id));
  if (shown.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Recent
      </h2>
      <ul className="divide-y border-y">
        {shown.map((chat) => {
          const title = chat.title ?? "New chat";
          const date = new Date(chat.updated_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <li key={chat.id} className="flex items-center gap-2">
              <Link
                href={`/create/${chat.id}`}
                className="flex min-w-0 flex-1 items-baseline justify-between gap-4 py-3.5 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="truncate font-serif text-base">{title}</span>
                <time
                  dateTime={chat.updated_at}
                  className="shrink-0 text-sm text-muted-foreground tabular-nums"
                >
                  {date}
                </time>
              </Link>
              <ResponsiveMenu>
                <ResponsiveMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`More for ${title}`}
                    className="-mr-2 h-10 w-10 shrink-0 text-muted-foreground sm:h-8 sm:w-8"
                  >
                    <MoreHorizontal className="size-5 sm:size-4" />
                  </Button>
                </ResponsiveMenuTrigger>
                <ResponsiveMenuContent
                  align="end"
                  title={`More for ${title}`}
                  header={<BottomSheetHeader title={title} meta={`Edited ${date}`} />}
                >
                  <ResponsiveMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting({ kind: "chat", id: chat.id, title })}
                  >
                    <Trash2 />
                    Delete
                  </ResponsiveMenuItem>
                </ResponsiveMenuContent>
              </ResponsiveMenu>
            </li>
          );
        })}
      </ul>

      <DeleteDialog
        item={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(item) => {
          setRemoved((prev) => new Set(prev).add(item.id));
          setDeleting(null);
          toast.success("Chat deleted");
          router.refresh();
        }}
      />
    </section>
  );
}
