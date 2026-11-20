import { Star } from "lucide-react";
import type { RatingStats } from "@/lib/meditation/ratings";
import { formatAverage, hasRatings, ratingSummaryLabel } from "@/lib/meditation/rating-display";
import { cn } from "@/lib/utils";

/**
 * A meditation's average alone, "★ 4.6", for a card's meta line and the
 * meditation page's header (card ZEN-10). The count is a finer detail: it
 * stays in the words a screen reader hears, and shows in the page's Ratings
 * section. Nothing when there are no ratings.
 */
export function RatingSummary({
  stats,
  className,
}: {
  stats: RatingStats | null | undefined;
  className?: string;
}) {
  if (!hasRatings(stats)) return null;

  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      <span className="sr-only">{ratingSummaryLabel(stats)}</span>
      <Star aria-hidden className="size-3 shrink-0 fill-current text-primary" />
      <span aria-hidden>{formatAverage(stats.average)}</span>
    </span>
  );
}
