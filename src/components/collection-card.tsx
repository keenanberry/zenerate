"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CollectionArtwork } from "@/components/collection-artwork";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { deleteCollection, updateCollection } from "@/lib/meditation/actions";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { CollectionWithCount } from "@/lib/meditation/types";

interface CollectionCardProps {
  collection: CollectionWithCount;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deleteCollection(collection.id);
    });
  }

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateCollection(collection.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setEditOpen(false);
    });
  }

  return (
    <>
      {/* A playlist, not a dashboard card: artwork, then the name and count (task 54). */}
      <div className="group relative space-y-3">
        <Link
          href={`/collections/${collection.id}`}
          tabIndex={-1}
          aria-hidden
          className="block motion-safe:transition-opacity hover:opacity-90"
        >
          <CollectionArtwork
            id={collection.id}
            covers={collection.covers ?? []}
            size={240}
          />
        </Link>
        <div className="flex items-start gap-2">
          <Link
            href={`/collections/${collection.id}`}
            className="min-w-0 flex-1 space-y-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <p className="truncate font-serif text-base leading-snug font-medium group-hover:text-accent-foreground">
              {collection.name}
            </p>
            <p className="truncate text-sm text-muted-foreground tabular-nums">
              {collection.item_count}{" "}
              {collection.item_count === 1 ? "meditation" : "meditations"}
              {collection.description && ` · ${collection.description}`}
            </p>
          </Link>
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) setConfirmDelete(false);
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More for ${collection.name}`}
                className="-mt-1 -mr-2 h-8 w-8 shrink-0 text-muted-foreground motion-safe:transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setName(collection.name);
                  setDescription(collection.description ?? "");
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit collection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isPending}
                onSelect={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
                {confirmDelete ? "Confirm delete" : "Delete collection"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>
              Update the name and description for this collection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`name-${collection.id}`}>Name</Label>
              <Input
                id={`name-${collection.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`desc-${collection.id}`}>Description</Label>
              <Textarea
                id={`desc-${collection.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
