"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getUserCollections,
  addToCollection,
  createCollection,
} from "@/lib/meditation/actions";
import { Input } from "@/components/ui/input";
import { FolderPlus, Plus, Check } from "lucide-react";
import type { CollectionWithCount } from "@/lib/meditation/types";

interface AddToCollectionDialogProps {
  meditationId: string;
  trigger?: React.ReactNode;
}

export function AddToCollectionDialog({
  meditationId,
  trigger,
}: AddToCollectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      getUserCollections().then(setCollections).catch(console.error);
    }
  }, [open]);

  function handleAdd(collectionId: string) {
    setAddedIds((prev) => new Set([...prev, collectionId]));
    startTransition(async () => {
      await addToCollection(collectionId, meditationId);
    });
  }

  function handleCreateAndAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const col = await createCollection({ name: newName.trim() });
      await addToCollection(col.id, meditationId);
      setAddedIds((prev) => new Set([...prev, col.id]));
      setCollections((prev) => [
        { ...col, item_count: 1 },
        ...prev,
      ]);
      setNewName("");
      setShowNew(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Add to collection
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
          <DialogDescription>
            Choose a collection or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => handleAdd(col.id)}
              disabled={isPending || addedIds.has(col.id)}
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span>{col.name}</span>
              {addedIds.has(col.id) ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}

          {showNew ? (
            <div className="flex gap-2">
              <Input
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleCreateAndAdd}
                disabled={!newName.trim() || isPending}
              >
                Add
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowNew(true)}
            >
              <Plus className="h-4 w-4" />
              New collection
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
