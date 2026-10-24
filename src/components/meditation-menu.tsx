"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  FolderPlus,
  Globe,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddToCollectionDialog } from "@/components/add-to-collection-dialog";

export type MeditationMenuProps = {
  meditationId: string;
  title: string;
  isSignedIn: boolean;
  isOwner: boolean;
  /** The chat that made it, for the owner's "Continue in chat". */
  chatId: string | null;
  /** Whether the audio exists: downloads, and the owner's Public/Private. */
  hasAudio: boolean;
};

/**
 * The meditation page's "…" (task 55). Everything but Play and the heart
 * lives here, so Play is the one thing under the title.
 */
export function MeditationMenu({
  meditationId,
  title,
  isSignedIn,
  isOwner,
  chatId,
  hasAudio,
  onEdit,
  visibility,
}: MeditationMenuProps & {
  onEdit: () => void;
  /** The owner's visibility, held by the header so its meta line agrees. */
  visibility: { isPublic: boolean; isPending: boolean; toggle: () => void } | null;
}) {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  // Set by the menu item, acted on once the menu has closed: opened while
  // the menu is still closing, the picker reads the menu's focus return as
  // an outside interaction and closes again at once.
  const collectionsNext = useRef(false);

  const ownerItems = isOwner;
  const shareItems = isSignedIn || hasAudio;
  if (!ownerItems && !shareItems) return null;

  const button = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`More for ${title}`}
      className="h-10 w-10 shrink-0 text-muted-foreground sm:h-8 sm:w-8"
    >
      <MoreHorizontal className="size-5 sm:size-4" />
    </Button>
  );

  return (
    <DropdownMenu>
      {isSignedIn ? (
        // The collection picker opens from a menu item, so it anchors to the
        // menu's button once the menu has closed.
        <AddToCollectionDialog
          meditationId={meditationId}
          open={collectionsOpen}
          onOpenChange={setCollectionsOpen}
          anchor={<DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>}
        />
      ) : (
        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align="end"
        className="min-w-52"
        onCloseAutoFocus={(e) => {
          if (!collectionsNext.current) return;
          collectionsNext.current = false;
          // Leave focus to the collection picker, which opens now.
          e.preventDefault();
          setCollectionsOpen(true);
        }}
      >
        {isOwner && (
          <>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit details
            </DropdownMenuItem>
            {chatId && (
              <DropdownMenuItem asChild>
                <Link href={`/create/${chatId}`}>
                  <MessageSquare />
                  Continue in chat
                </Link>
              </DropdownMenuItem>
            )}
            {visibility && (
              <DropdownMenuItem
                disabled={visibility.isPending}
                onSelect={visibility.toggle}
              >
                {visibility.isPublic ? <Lock /> : <Globe />}
                {visibility.isPublic ? "Make private" : "Make public"}
              </DropdownMenuItem>
            )}
            {shareItems && <DropdownMenuSeparator />}
          </>
        )}
        {isSignedIn && (
          <DropdownMenuItem onSelect={() => (collectionsNext.current = true)}>
            <FolderPlus />
            Add to collection
          </DropdownMenuItem>
        )}
        {hasAudio && (
          <DropdownMenuItem asChild>
            {isSignedIn ? (
              <a href={`/api/audio/${meditationId}/download`}>
                <Download />
                Download
              </a>
            ) : (
              <Link href="/login">
                <Download />
                Sign in to download
              </Link>
            )}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
