"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/lib/meditation/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FavoriteState = {
  isFavorited: boolean;
  isPending: boolean;
  toggle: () => void;
};

/**
 * A meditation's favourite, optimistic. The meditation page holds one and
 * shares it between the heart by the title and the session view's menu, so
 * the two never disagree.
 */
export function useFavorite(
  meditationId: string,
  initialFavorited: boolean,
): FavoriteState {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setIsFavorited(!isFavorited);
    startTransition(async () => {
      try {
        await toggleFavorite(meditationId);
      } catch {
        setIsFavorited(isFavorited);
        // No success toast -- the filled heart is confirmation enough. The
        // failure case needs one, because the heart silently snapping back
        // is indistinguishable from a UI glitch.
        toast.error("Couldn't update favorite");
      }
    });
  }

  return { isFavorited, isPending, toggle };
}

interface FavoriteButtonProps {
  meditationId: string;
  isFavorited: boolean;
  /** The meditation's title, for the button's accessible name. */
  title?: string;
  /** A favourite held elsewhere (the meditation page's); otherwise its own. */
  state?: FavoriteState;
  className?: string;
}

export function FavoriteButton({
  meditationId,
  isFavorited: initialFavorited,
  title,
  state,
  className,
}: FavoriteButtonProps) {
  const own = useFavorite(meditationId, initialFavorited);
  const { isFavorited, isPending, toggle } = state ?? own;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={isFavorited}
      aria-label={
        title
          ? `${isFavorited ? "Remove" : "Add"} ${title} ${isFavorited ? "from" : "to"} favorites`
          : isFavorited
            ? "Remove from favorites"
            : "Add to favorites"
      }
      className={cn("h-10 w-10 sm:h-8 sm:w-8", className)}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          isFavorited && "fill-current text-primary"
        )}
      />
    </Button>
  );
}
