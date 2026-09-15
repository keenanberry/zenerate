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
import { toast } from "sonner";
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
      .catch(() => {
        // Without this the popover renders "No collections yet", which is
        // indistinguishable from genuinely having none.
        if (!cancelled) toast.error("Couldn't load collections");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, meditationId]);

  /** Apply a membership change to local state. Symmetrical, so the optimistic
   *  update and its rollback are the same call with inverted arguments. */
  function applyMembership(
    collectionId: string,
    selected: boolean,
    delta: number,
  ) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(collectionId);
      else next.delete(collectionId);
      return next;
    });
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, item_count: c.item_count + delta } : c,
      ),
    );
  }

  function handleToggle(collectionId: string) {
    const isSelected = selectedIds.has(collectionId);
    const delta = isSelected ? -1 : 1;
    const name =
      collections.find((c) => c.id === collectionId)?.name ?? "collection";

    applyMembership(collectionId, !isSelected, delta);

    startTransition(async () => {
      try {
        if (isSelected) {
          await removeFromCollection(collectionId, meditationId);
          toast.success(`Removed from ${name}`);
        } else {
          await addToCollection(collectionId, meditationId);
          toast.success(`Added to ${name}`);
        }
      } catch {
        applyMembership(collectionId, isSelected, -delta);
        toast.error(
          isSelected
            ? `Couldn't remove from ${name}`
            : `Couldn't add to ${name}`,
        );
      }
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      let col;
      try {
        col = await createCollection({ name });
      } catch {
        toast.error("Couldn't create collection");
        return;
      }

      // The collection now exists. If adding to it fails, say so precisely --
      // reporting "couldn't create" would leave the user surprised by an
      // empty collection the next time they open this popover.
      try {
        await addToCollection(col.id, meditationId);
      } catch {
        setCollections((prev) => [{ ...col, item_count: 0 }, ...prev]);
        setNewName("");
        setShowNew(false);
        toast.error(`Created ${name}, but couldn't add this meditation`);
        return;
      }

      setSelectedIds((prev) => new Set([...prev, col.id]));
      setCollections((prev) => [{ ...col, item_count: 1 }, ...prev]);
      setNewName("");
      setShowNew(false);
      toast.success(`Added to ${name}`);
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
