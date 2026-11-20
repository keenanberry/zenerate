"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeditationCover } from "@/components/meditation-cover";
import { RatingSummary } from "@/components/rating-summary";
import { metaLine } from "@/lib/meditation/meta";
import {
  ACCOUNT_BOOKMARK_PAGE,
  setBookmark,
  setBookmarkOverride,
} from "@/lib/meditation/bookmark-state";
import type { Bookmark as SavedBookmark, BookmarkPage } from "@/lib/meditation/bookmarks";

/**
 * The listener's bookmarks on /account (card ZEN-8), newest first: the first
 * page arrives with the page, and "Load more" reads the next from
 * GET /api/bookmarks. Removing one takes it off the list at once and puts it
 * back, with a toast, if the DELETE fails.
 */
export function AccountBookmarks({
  initial,
  empty,
}: {
  initial: BookmarkPage;
  /** Shown when there are none, or none left. */
  empty: ReactNode;
}) {
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>(initial.bookmarks);
  const [cursor, setCursor] = useState(initial.next_cursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookmarks?limit=${ACCOUNT_BOOKMARK_PAGE}&cursor=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) throw new Error(`GET /api/bookmarks ${res.status}`);
      const page = (await res.json()) as BookmarkPage;
      setBookmarks((prev) => {
        const seen = new Set(prev.map((b) => b.meditation.id));
        return [...prev, ...page.bookmarks.filter((b) => !seen.has(b.meditation.id))];
      });
      setCursor(page.next_cursor);
    } catch {
      toast.error("Couldn't load more bookmarks");
    } finally {
      setLoading(false);
    }
  }

  async function remove(bookmark: SavedBookmark) {
    const id = bookmark.meditation.id;
    const index = bookmarks.findIndex((b) => b.meditation.id === id);
    setBookmarks((prev) => prev.filter((b) => b.meditation.id !== id));
    setBookmarkOverride(id, false);

    if ((await setBookmark(id, false)) === "ok") return;
    setBookmarkOverride(id, true);
    setBookmarks((prev) => {
      if (prev.some((b) => b.meditation.id === id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, bookmark);
      return next;
    });
    toast.error("Couldn't remove from saved");
  }

  if (bookmarks.length === 0 && !cursor) return <>{empty}</>;

  return (
    <div className="space-y-4">
      {bookmarks.length > 0 && (
        <ul className="divide-y border-y">
          {bookmarks.map((b) => (
            <BookmarkRow key={b.meditation.id} bookmark={b} onRemove={() => void remove(b)} />
          ))}
        </ul>
      )}
      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function BookmarkRow({ bookmark, onRemove }: { bookmark: SavedBookmark; onRemove: () => void }) {
  const m = bookmark.meditation;
  const href = `/meditation/${m.id}`;
  const meta = metaLine({ tags: m.tags, settings: m.settings });

  return (
    <li className="flex items-center gap-3">
      <Link
        href={href}
        className="group flex min-w-0 flex-1 items-center gap-4 rounded-md py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <MeditationCover id={m.id} tags={m.tags ?? []} title={m.title} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-base group-hover:text-accent-foreground">
            {m.title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
            {m.author?.display_name && (
              <span className="min-w-0 truncate">{m.author.display_name}</span>
            )}
            {m.author?.display_name && meta && <span aria-hidden>·</span>}
            {meta && <span className="shrink-0">{meta}</span>}
            <RatingSummary stats={m.rating} className="shrink-0" />
          </span>
        </span>
      </Link>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
      >
        <Link href={href} aria-label={`Play ${m.title}`}>
          <Play aria-hidden className="size-4" />
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${m.title} from saved`}
            className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
          >
            <Bookmark aria-hidden className="size-4 fill-current text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Remove from saved</p>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
