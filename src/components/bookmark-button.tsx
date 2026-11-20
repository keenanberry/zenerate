"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  bookmarkLabel,
  bookmarkOverride,
  bookmarkTooltip,
  setBookmark,
  setBookmarkOverride,
  signInHref,
  subscribeBookmarks,
} from "@/lib/meditation/bookmark-state";
import { cn } from "@/lib/utils";

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * A meditation's bookmark (card ZEN-8), optimistic, as the heart is. The
 * state is shared by meditation id (bookmark-state.ts), so every control for
 * the same meditation agrees. Signed out, a tap goes to sign-in and back.
 */
export function useBookmark(meditationId: string, initialBookmarked: boolean, isSignedIn: boolean) {
  const router = useRouter();
  const override = useSyncExternalStore(
    subscribeBookmarks,
    () => bookmarkOverride(meditationId),
    () => undefined,
  );
  const isBookmarked = override ?? initialBookmarked;
  const [isPending, setIsPending] = useState(false);

  async function toggle() {
    if (!isSignedIn) {
      router.push(signInHref(currentPath()));
      return;
    }
    const next = !isBookmarked;
    setBookmarkOverride(meditationId, next);
    setIsPending(true);
    const result = await setBookmark(meditationId, next);
    setIsPending(false);
    if (result === "ok") return;

    setBookmarkOverride(meditationId, isBookmarked);
    if (result === "signed_out") {
      router.push(signInHref(currentPath()));
    } else {
      // No success toast: the filled bookmark says it. A silent snap back
      // would read as a glitch, so the failure gets one.
      toast.error(next ? "Couldn't save for later" : "Couldn't remove from saved");
    }
  }

  return { isBookmarked, isPending, toggle };
}

interface BookmarkButtonProps {
  meditationId: string;
  isBookmarked: boolean;
  isSignedIn: boolean;
  /** The meditation's title, for the button's accessible name. */
  title?: string;
  /**
   * `cover` sits on a cover's corner (Discover's shelves), on a chip of the
   * page's own background so it reads over any art.
   */
  variant?: "ghost" | "cover";
  className?: string;
}

export function BookmarkButton({
  meditationId,
  isBookmarked: initialBookmarked,
  isSignedIn,
  title,
  variant = "ghost",
  className,
}: BookmarkButtonProps) {
  const { isBookmarked, isPending, toggle } = useBookmark(meditationId, initialBookmarked, isSignedIn);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(event) => {
            // Never the card's link underneath, whatever it is nested in.
            event.preventDefault();
            event.stopPropagation();
            void toggle();
          }}
          disabled={isPending}
          aria-pressed={isSignedIn ? isBookmarked : undefined}
          aria-label={bookmarkLabel(isBookmarked, title)}
          className={cn(
            "h-10 w-10 sm:h-8 sm:w-8",
            variant === "cover" &&
              "rounded-full bg-background/80 text-foreground hover:bg-background hover:text-foreground dark:hover:bg-background",
            className,
          )}
        >
          <Bookmark
            aria-hidden
            className={cn(
              "h-4 w-4 motion-safe:transition-colors",
              isBookmarked && "fill-current text-primary",
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{bookmarkTooltip(isBookmarked)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
