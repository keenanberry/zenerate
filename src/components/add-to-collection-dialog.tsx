"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  getUserCollections,
  getMeditationCollectionIds,
  addToCollection,
  removeFromCollection,
  createCollection,
} from "@/lib/meditation/actions";
import { Input } from "@/components/ui/input";
import { FolderPlus, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      getUserCollections(),
      getMeditationCollectionIds(meditationId),
    ])
      .then(([cols, ids]) => {
        if (cancelled) return;
        setCollections(cols);
        setSelectedIds(new Set(ids));
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, meditationId]);

  function handleToggle(collectionId: string) {
    const isSelected = selectedIds.has(collectionId);
    const delta = isSelected ? -1 : 1;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, item_count: c.item_count + delta } : c,
      ),
    );
    startTransition(async () => {
      if (isSelected) {
        await removeFromCollection(collectionId, meditationId);
      } else {
        await addToCollection(collectionId, meditationId);
      }
    });
  }

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const col = await createCollection({ name: newName.trim() });
      await addToCollection(col.id, meditationId);
      setSelectedIds((prev) => new Set([...prev, col.id]));
      setCollections((prev) => [{ ...col, item_count: 1 }, ...prev]);
      setNewName("");
      setShowNew(false);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setLoading(true);
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Add to collection
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Collections</p>
        </div>

        <div className="max-h-56 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 && !showNew ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No collections yet
            </p>
          ) : (
            collections.map((col) => {
              const checked = selectedIds.has(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => handleToggle(col.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{col.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {col.item_count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t p-2">
          {showNew ? (
            <div className="flex gap-1.5">
              <Input
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-8 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 shrink-0"
                onClick={handleCreate}
                disabled={!newName.trim() || isPending}
              >
                Add
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              New collection
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
