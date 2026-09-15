"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/lib/meditation/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  meditationId: string;
  isFavorited: boolean;
  size?: "sm" | "default";
}

export function FavoriteButton({
  meditationId,
  isFavorited: initialFavorited,
  size = "sm",
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
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

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "default"}
      onClick={handleToggle}
      disabled={isPending}
      className={cn(size === "sm" && "h-8 w-8")}
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
