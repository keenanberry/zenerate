"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeditationCard } from "@/components/meditation-card";
import { TrackRow, type TrackRowMeditation } from "@/components/track-row";
import { useView } from "@/components/view-context";
import {
  ACCOUNT_BOOKMARK_PAGE,
  setBookmark,
  setBookmarkOverride,
} from "@/lib/meditation/bookmark-state";
import type {
  Bookmark as SavedBookmark,
  BookmarkedMeditation,
  BookmarkPage,
} from "@/lib/meditation/bookmarks";

/**
 * The listener's bookmarks on /library/bookmarks (card ZEN-8), newest first,
 * as a track list or a grid of tiles (the nearest ViewProvider's choice), as
 * Favorites draws them: the first page arrives with the page, and "Load more"
 * reads the next from GET /api/bookmarks, both with their audio signed.
 * Removing one takes it off the list at once and puts it back, with a toast,
 * if the DELETE fails.
 */
export function AccountBookmarks({
  initial,
  empty,
}: {
  initial: BookmarkPage;
  /** Shown when there are none, or none left. */
  empty: ReactNode;
}) {
  const router = useRouter();
  const { view } = useView();
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>(initial.bookmarks);
  const [cursor, setCursor] = useState(initial.next_cursor);
  const [loading, setLoading] = useState(false);
  // Where focus goes once a removed row has left the DOM: the id of the row
  // whose remove button takes it, null for "no row left", false for nothing
  // pending. Without this, focus falls to <body> with the button it was on.
  const focusAfterRemove = useRef<string | null | false>(false);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const loadMoreButton = useRef<HTMLButtonElement>(null);
  const emptyState = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === false) return;
    focusAfterRemove.current = false;
    const row = target === null ? undefined : removeButtons.current.get(target);
    (row ?? loadMoreButton.current ?? emptyState.current)?.focus();
  }, [bookmarks]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookmarks?limit=${ACCOUNT_BOOKMARK_PAGE}&cursor=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) throw new Error(`GET /api/bookmarks ${res.status}`);
      const page = (await res.json()) as BookmarkPage;
      setBookmarks((prev) => appendBookmarks(prev, page.bookmarks));
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
    const neighbour = bookmarks[index + 1] ?? bookmarks[index - 1];
    focusAfterRemove.current = neighbour?.meditation.id ?? null;
    setBookmarks((prev) => prev.filter((b) => b.meditation.id !== id));
    setBookmarkOverride(id, false);

    if ((await setBookmark(id, false)) === "ok") {
      // Clears the client router cache, so a Back to the Library shows the
      // new count; this list keeps its own state.
      router.refresh();
      return;
    }
    setBookmarkOverride(id, true);
    setBookmarks((prev) => {
      if (prev.some((b) => b.meditation.id === id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, bookmark);
      return next;
    });
    toast.error("Couldn't remove from saved");
  }

  if (bookmarks.length === 0 && !cursor) {
    return (
      // Focusable from script only, to take focus when the last row goes.
      <div ref={emptyState} tabIndex={-1} className="outline-none">
        {empty}
      </div>
    );
  }

  const removeButton = (b: SavedBookmark) => (
    <RemoveBookmarkButton
      title={b.meditation.title}
      onRemove={() => void remove(b)}
      buttonRef={(el) => {
        if (el) removeButtons.current.set(b.meditation.id, el);
        else removeButtons.current.delete(b.meditation.id);
      }}
    />
  );

  return (
    <div className="space-y-4">
      {bookmarks.length > 0 &&
        (view === "grid" ? (
          // MeditationListView's grid: the remove control where a tile's
          // heart sits, and no heart, as in the rows.
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {bookmarks.map((b) => (
              <MeditationCard
                key={b.meditation.id}
                meditation={toTrack(b.meditation)}
                showFavorite={false}
                byline={b.meditation.author?.display_name ?? undefined}
                actions={removeButton(b)}
              />
            ))}
          </div>
        ) : (
          // The rows Favorites draws (task 48): the index column plays in
          // place from sm, and the remove control takes the heart's place.
          <div className="w-full">
            {bookmarks.map((b, i) => (
              <TrackRow
                key={b.meditation.id}
                meditation={toTrack(b.meditation)}
                index={i + 1}
                showIndex
                showFavorite={false}
                showVisibility={false}
                byline={b.meditation.author?.display_name ?? undefined}
                actions={removeButton(b)}
              />
            ))}
          </div>
        ))}
      {cursor && (
        <div className="flex justify-center">
          <Button
            ref={loadMoreButton}
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The next page after the list so far, less any already in it. Both views
 * draw from this one list, so a page appends to whichever is showing.
 */
export function appendBookmarks(prev: SavedBookmark[], next: SavedBookmark[]): SavedBookmark[] {
  const seen = new Set(prev.map((b) => b.meditation.id));
  return [...prev, ...next.filter((b) => !seen.has(b.meditation.id))];
}

/**
 * The bookmark's meditation as a track row or tile reads it. A bookmark is always
 * public and completed. No created_at: the row has never shown a date, and
 * with the author leading the line a date would not fit a phone.
 */
function toTrack(m: BookmarkedMeditation): TrackRowMeditation {
  return {
    id: m.id,
    title: m.title,
    tags: m.tags ?? [],
    settings: m.settings ?? {},
    status: m.status,
    // Signed by withBookmarkAudio (bookmark-audio.ts); null if signing failed, and
    // the row then opens the page to play.
    audio_url: m.audio_url ?? null,
    is_public: true,
    rating: m.rating ?? undefined,
    cover_url: m.cover_url,
  };
}

function RemoveBookmarkButton({
  title,
  onRemove,
  buttonRef,
}: {
  title: string;
  onRemove: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${title} from saved`}
          className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
        >
          <Bookmark aria-hidden className="size-4 fill-current text-primary" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Remove from saved</p>
      </TooltipContent>
    </Tooltip>
  );
}
