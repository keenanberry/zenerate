"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Flag,
  FolderPlus,
  Globe,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheetHeader } from "@/components/ui/bottom-sheet";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} from "@/components/ui/responsive-menu";
import { AddToCollectionDialog } from "@/components/add-to-collection-dialog";
import { DeleteDialog } from "@/components/delete-dialog";
import { MeditationCover } from "@/components/meditation-cover";
import { shareMeditation, sharePayload } from "@/lib/meditation/share";
import { TAG_LABELS, isTag } from "@/lib/meditation/tags";

export type MeditationMenuProps = {
  meditationId: string;
  title: string;
  isSignedIn: boolean;
  isOwner: boolean;
  /** The chat that made it, for the owner's "Continue in chat". */
  chatId: string | null;
  /** Whether the audio exists: downloads, and the owner's Public/Private. */
  hasAudio: boolean;
  /** A visitor's mailto for reporting a public meditation (task 53); null for the owner. */
  reportHref: string | null;
  /** Whether it is public as the server last saw it; the owner's toggle overrides it. */
  isPublic: boolean;
  /** The site's origin, for the canonical link Share hands out (task 59). */
  siteUrl: string;
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
  reportHref,
  isPublic,
  siteUrl,
  onEdit,
  visibility,
  tags = [],
  meta,
}: MeditationMenuProps & {
  onEdit: () => void;
  /** For the phone sheet's header: the cover, and the first tag on the meta line. */
  tags?: string[];
  /** The length, e.g. "20 min", after the tag on the sheet's meta line. */
  meta?: string;
  /** The owner's visibility, held by the header so its meta line agrees. */
  visibility: { isPublic: boolean; isPending: boolean; toggle: () => void } | null;
}) {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  // Set by the menu item, acted on once the menu has closed: opened while
  // the menu is still closing, the picker reads the menu's focus return as
  // an outside interaction and closes again at once.
  const collectionsNext = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // A private link 404s for everyone else, so Share shows only while it is
  // public: the owner's toggle once the audio exists, the server's word before.
  const canShare = visibility?.isPublic ?? isPublic;
  const visitorItems = canShare || isSignedIn || hasAudio;
  if (!isOwner && !visitorItems && !reportHref) return null;

  async function share() {
    const outcome = await shareMeditation(sharePayload({ id: meditationId, title }, siteUrl));
    if (outcome === "copied") toast.success("Link copied");
    if (outcome === "failed") toast.error("Couldn't share this link");
  }

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

  const tag = tags.find(isTag);
  const header = (
    <BottomSheetHeader
      art={<MeditationCover id={meditationId} tags={tags} title={title} size={48} />}
      title={title}
      meta={[tag && TAG_LABELS[tag], meta].filter(Boolean).join(" · ")}
    />
  );

  return (
    <>
      <ResponsiveMenu>
        {isSignedIn ? (
          // The collection picker opens from a menu item: on desktop it
          // anchors to the menu's button once the menu has closed; on a phone
          // it is a sheet of its own, risen once the menu's sheet has gone.
          <AddToCollectionDialog
            meditationId={meditationId}
            open={collectionsOpen}
            onOpenChange={setCollectionsOpen}
            anchor={<ResponsiveMenuTrigger asChild>{button}</ResponsiveMenuTrigger>}
          />
        ) : (
          <ResponsiveMenuTrigger asChild>{button}</ResponsiveMenuTrigger>
        )}
        <ResponsiveMenuContent
          title={`More for ${title}`}
          header={header}
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
              <ResponsiveMenuItem onSelect={onEdit}>
                <Pencil />
                Edit details
              </ResponsiveMenuItem>
              {chatId && (
                <ResponsiveMenuItem asChild>
                  <Link href={`/create/${chatId}`}>
                    <MessageSquare />
                    Continue in chat
                  </Link>
                </ResponsiveMenuItem>
              )}
              {visibility && (
                <ResponsiveMenuItem
                  disabled={visibility.isPending}
                  onSelect={visibility.toggle}
                >
                  {visibility.isPublic ? <Lock /> : <Globe />}
                  {visibility.isPublic ? "Make private" : "Make public"}
                </ResponsiveMenuItem>
              )}
              {visitorItems && <ResponsiveMenuSeparator />}
            </>
          )}
          {canShare && (
            <ResponsiveMenuItem onSelect={share}>
              <Share />
              Share
            </ResponsiveMenuItem>
          )}
          {isSignedIn && (
            <ResponsiveMenuItem onSelect={() => (collectionsNext.current = true)}>
              <FolderPlus />
              Add to collection
            </ResponsiveMenuItem>
          )}
          {hasAudio && (
            <ResponsiveMenuItem asChild>
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
            </ResponsiveMenuItem>
          )}
          {reportHref && (
            <>
              {visitorItems && <ResponsiveMenuSeparator />}
              <ResponsiveMenuItem asChild>
                <a href={reportHref}>
                  <Flag />
                  Report
                </a>
              </ResponsiveMenuItem>
            </>
          )}
          {isOwner && (
            <>
              <ResponsiveMenuSeparator />
              <ResponsiveMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </ResponsiveMenuItem>
            </>
          )}
        </ResponsiveMenuContent>
      </ResponsiveMenu>
      {isOwner && (
        <DeleteDialog
          item={deleting ? { kind: "meditation", id: meditationId, title } : null}
          onOpenChange={setDeleting}
          onDeleted={() => {
            // Closed now, so its Delete can't send again while the page goes.
            setDeleting(false);
            toast.success("Meditation deleted");
            // Its page is gone; the Library is where the owner's others are.
            router.replace("/library");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
