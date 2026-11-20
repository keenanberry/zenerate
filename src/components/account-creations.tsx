"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteDialog, type Deletable } from "@/components/delete-dialog";
import { cn } from "@/lib/utils";

export type AccountMeditation = {
  id: string;
  title: string;
  is_public: boolean;
  created_at: string;
};

export type AccountChat = {
  id: string;
  title: string;
  updated_at: string;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the closed disclosure says it holds, e.g. "2 meditations · 1 chat". */
export function creationsSummary(meditations: number, chats: number) {
  return [
    meditations > 0 && plural(meditations, "meditation", "meditations"),
    chats > 0 && plural(chats, "chat", "chats"),
  ]
    .filter(Boolean)
    .join(" · ");
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The owner's meditations and studio chats on /account, each with a Delete
 * behind a confirmation. A deleted row leaves the list at once; the refresh
 * that follows brings the server's word.
 *
 * The lists start closed behind a "Show" row (card ZEN-11): the account page
 * leads with the profile and bookmarks, and the studio is where creations are
 * worked on. With nothing to list, the empty state shows directly.
 */
export function AccountCreations({
  meditations,
  chats,
  empty,
  defaultOpen = false,
}: {
  meditations: AccountMeditation[];
  chats: AccountChat[];
  /** Shown when there is nothing, or nothing left. */
  empty: ReactNode;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<Deletable | null>(null);

  const shownMeditations = meditations.filter((m) => !removed.has(m.id));
  const shownChats = chats.filter((c) => !removed.has(c.id));
  if (shownMeditations.length === 0 && shownChats.length === 0) return <>{empty}</>;

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? "account-creations-list" : undefined}
        className="flex w-full items-center justify-between gap-4 rounded-md py-4 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
      >
        <span>
          {open ? "Hide" : "Show"}{" "}
          <span className="font-normal tabular-nums">
            {creationsSummary(shownMeditations.length, shownChats.length)}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id="account-creations-list" className="space-y-8 pt-2">
          {shownMeditations.length > 0 && (
            <CreationList label="Meditations">
              {shownMeditations.map((m) => (
                <CreationRow
                  key={m.id}
                  href={`/meditation/${m.id}`}
                  title={m.title}
                  meta={`${m.is_public ? "Public" : "Private"} · ${shortDate(m.created_at)}`}
                  onDelete={() => setDeleting({ kind: "meditation", id: m.id, title: m.title })}
                />
              ))}
            </CreationList>
          )}
          {shownChats.length > 0 && (
            <CreationList label="Studio chats">
              {shownChats.map((c) => (
                <CreationRow
                  key={c.id}
                  href={`/create/${c.id}`}
                  title={c.title}
                  meta={`Updated ${shortDate(c.updated_at)}`}
                  onDelete={() => setDeleting({ kind: "chat", id: c.id, title: c.title })}
                />
              ))}
            </CreationList>
          )}
        </div>
      )}

      <DeleteDialog
        item={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(item) => {
          setRemoved((prev) => new Set(prev).add(item.id));
          setDeleting(null);
          toast.success(item.kind === "meditation" ? "Meditation deleted" : "Chat deleted");
          router.refresh();
        }}
      />
    </div>
  );
}

function CreationList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </h3>
      <ul className="divide-y border-y">{children}</ul>
    </div>
  );
}

function CreationRow({
  href,
  title,
  meta,
  onDelete,
}: {
  href: string;
  title: string;
  meta: string;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <Link
        href={href}
        className="min-w-0 flex-1 py-3.5 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="block truncate font-serif text-base">{title}</span>
        <span className="block text-sm text-muted-foreground tabular-nums">{meta}</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label={`Delete ${title}`}
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
      >
        <Trash2 className="size-5 sm:size-4" />
      </Button>
    </li>
  );
}
