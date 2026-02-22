"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { removeFromCollection } from "@/lib/meditation/actions";

export function RemoveFromCollectionButton({
  collectionId,
  meditationId,
}: {
  collectionId: string;
  meditationId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="mt-3 h-8 w-8 shrink-0"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await removeFromCollection(collectionId, meditationId);
        });
      }}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
