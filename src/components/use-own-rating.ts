"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

export type OwnRatingState = {
  /** The listener's stars, or null before they rate. */
  stars: number | null;
  isPending: boolean;
  /** Saves at once; resolves false (and puts the old value back) on failure. */
  rate: (stars: number) => Promise<boolean>;
  clear: () => void;
};

/**
 * The signed-in listener's own rating of a meditation, optimistic, through
 * /api/meditations/[id]/rating (card ZEN-5). The meditation page holds one
 * and shares it between the end-of-session prompt and the stars on the page.
 */
export function useOwnRating(meditationId: string, initial: number | null): OwnRatingState {
  const [stars, setStars] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const url = `/api/meditations/${meditationId}/rating`;

  const rate = useCallback(
    (next: number) => {
      const previous = stars;
      setStars(next);
      return new Promise<boolean>((resolve) => {
        startTransition(async () => {
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stars: next }),
          }).catch(() => null);
          if (res?.ok) return resolve(true);
          setStars(previous);
          toast.error("Couldn't save your rating");
          resolve(false);
        });
      });
    },
    [stars, url],
  );

  const clear = useCallback(() => {
    const previous = stars;
    setStars(null);
    startTransition(async () => {
      const res = await fetch(url, { method: "DELETE" }).catch(() => null);
      if (res?.ok) return;
      setStars(previous);
      toast.error("Couldn't clear your rating");
    });
  }, [stars, url]);

  return { stars, isPending, rate, clear };
}
