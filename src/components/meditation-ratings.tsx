"use client";

import { useId, useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { useMeditationPage } from "@/components/meditation-page";
import type { RatingStats } from "@/lib/meditation/ratings";
import {
  formatAverage,
  hasRatings,
  ratedAgo,
  ratingCountLabel,
  ratingSummaryLabel,
} from "@/lib/meditation/rating-display";

/**
 * The finer rating detail, below the script (card ZEN-10, after Insight
 * Timer's): the average with its count in small type, then the listener's
 * own rating, when they gave it, and the stars to change it. The header
 * carries only the average, so rating is there for whoever looks for it
 * rather than asked of everyone at the top.
 */
export function MeditationRatings({
  title,
  stats,
}: {
  title: string;
  /** Undefined when the average could not be read; null is "No ratings yet". */
  stats: RatingStats | null | undefined;
}) {
  const own = useMeditationPage()?.ownRating ?? null;
  const headingId = useId();
  const inBrowser = useInBrowser();
  if (stats === undefined && !own) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-5 border-t pt-5">
      <h2
        id={headingId}
        className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase"
      >
        Ratings
      </h2>

      {stats !== undefined &&
        (hasRatings(stats) ? (
          <p className="flex items-baseline gap-2 tabular-nums">
            <span className="sr-only">{ratingSummaryLabel(stats)}</span>
            <Star aria-hidden className="size-4 shrink-0 self-center fill-current text-primary" />
            <span aria-hidden className="font-serif text-2xl font-medium">
              {formatAverage(stats.average)}
            </span>
            <span aria-hidden className="text-xs text-muted-foreground">
              {ratingCountLabel(stats.count)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No ratings yet</p>
        ))}

      {own && (
        <div>
          <p className="text-sm font-medium">
            {own.stars === null ? "Rate this meditation" : "Your rating"}
          </p>
          {own.stars !== null && own.ratedAt && (
            // In the browser's time zone, so after hydration: a mismatched
            // server text would stay. A blank line holds the space until then.
            <p className="text-xs text-muted-foreground">
              {inBrowser ? ratedAgo(own.ratedAt) : "\u00a0"}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <StarRating
              value={own.stars}
              onRate={(stars) => void own.rate(stars)}
              // One write at a time, so two quick taps cannot land out of order.
              disabled={own.isPending}
              label={`Rate ${title}`}
              className="-ml-2"
            />
            {own.stars !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={own.clear}
                disabled={own.isPending}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const noSubscription = () => () => {};

/** False on the server and while hydrating, true once rendered in the browser. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
