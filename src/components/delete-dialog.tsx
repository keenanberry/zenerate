"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export type Deletable = {
  kind: "meditation" | "chat";
  id: string;
  title: string;
};

/** What the dialog says about each kind, and where its DELETE goes. */
export const DELETE_COPY = {
  meditation: {
    endpoint: (id: string) => `/api/meditations/${id}`,
    heading: "Delete this meditation?",
    body: "Its audio and earlier versions are deleted with it, and it leaves Discover and anyone's favorites and collections. The studio chat it was made in is kept. This can't be undone.",
  },
  chat: {
    endpoint: (id: string) => `/api/chats/${id}`,
    heading: "Delete this chat?",
    body: "The whole conversation is deleted. A meditation made in it is kept. This can't be undone.",
  },
} as const;

/**
 * Asks before deleting a meditation or a chat, then sends the owner-only
 * DELETE. Stays open with the server's message when the delete is refused
 * (a render in progress, say), and calls `onDeleted` once it is done.
 */
export function DeleteDialog({
  item,
  onOpenChange,
  onDeleted,
}: {
  /** What to delete; null keeps the dialog closed. */
  item: Deletable | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (item: Deletable) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = item ? DELETE_COPY[item.kind] : null;

  async function confirm() {
    if (!item || !copy) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(copy.endpoint(item.id), { method: "DELETE" });
      // A 404 is already gone: someone deleted it in another tab.
      if (res.ok || res.status === 404) {
        onDeleted(item);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Couldn't delete it. Try again.");
    } catch {
      setError("Couldn't reach Zenerate. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open={item !== null}
      onOpenChange={(open) => {
        if (pending) return;
        if (!open) setError(null);
        onOpenChange(open);
      }}
      title={copy?.heading}
      description={
        <>
          <span className="font-medium text-foreground">{item?.title}</span>
          <span className="mt-2 block">{copy?.body}</span>
        </>
      }
      // sm: only, so a phone keeps the primitive's 1rem gutter each side.
      className="sm:max-w-md"
      showCloseButton={false}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              onOpenChange(false);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
            Delete
          </Button>
        </>
      }
    >
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
    </ResponsiveDialog>
  );
}
