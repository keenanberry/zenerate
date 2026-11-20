"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/delete-dialog";

/**
 * The studio chat's title and its Delete. Only the owner reaches the studio
 * (getChat reads the chat through RLS), so there is no owner test here.
 * Delete waits while a reply is streaming: the route saves the turn once it
 * ends, and a chat deleted under it would lose that save.
 */
export function ChatHeader({
  chatId,
  title,
  live,
}: {
  chatId: string;
  title: string | null;
  live: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const name = title ?? "New chat";

  return (
    <div className="flex items-center gap-2 pb-3">
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{name}</h1>
      <Button
        variant="ghost"
        size="icon"
        disabled={live}
        onClick={() => setDeleting(true)}
        aria-label="Delete this chat"
        title="Delete this chat"
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
      >
        <Trash2 className="size-5 sm:size-4" />
      </Button>
      <DeleteDialog
        item={deleting ? { kind: "chat", id: chatId, title: name } : null}
        onOpenChange={setDeleting}
        onDeleted={() => {
          setDeleting(false);
          toast.success("Chat deleted");
          router.replace("/create");
          router.refresh();
        }}
      />
    </div>
  );
}
