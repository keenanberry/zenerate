"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

export type OwnRatingState = {
  /** The listener's stars, or null before they rate. */
  stars: number | null;
  /** When they last rated (the row's updated_at), or null before they rate. */
  ratedAt: string | null;
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
export function useOwnRating(
  meditationId: string,
  initial: { stars: number | null; ratedAt: string | null },
): OwnRatingState {
  const [stars, setStars] = useState(initial.stars);
  const [ratedAt, setRatedAt] = useState(initial.ratedAt);
  const [isPending, startTransition] = useTransition();
  const url = `/api/meditations/${meditationId}/rating`;

  const rate = useCallback(
    (next: number) => {
      const previous = { stars, ratedAt };
      setStars(next);
      setRatedAt(new Date().toISOString());
      return new Promise<boolean>((resolve) => {
        startTransition(async () => {
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stars: next }),
          }).catch(() => null);
          if (res?.ok) {
            // The server's clock, so "Today" agrees with a reload.
            const body = await res.json().catch(() => null);
            if (typeof body?.rating?.updated_at === "string") setRatedAt(body.rating.updated_at);
            return resolve(true);
          }
          setStars(previous.stars);
          setRatedAt(previous.ratedAt);
          toast.error("Couldn't save your rating");
          resolve(false);
        });
      });
    },
    [stars, ratedAt, url],
  );

  const clear = useCallback(() => {
    const previous = { stars, ratedAt };
    setStars(null);
    setRatedAt(null);
    startTransition(async () => {
      const res = await fetch(url, { method: "DELETE" }).catch(() => null);
      if (res?.ok) return;
      setStars(previous.stars);
      setRatedAt(previous.ratedAt);
      toast.error("Couldn't clear your rating");
    });
  }, [stars, ratedAt, url]);

  return { stars, ratedAt, isPending, rate, clear };
}
