import { Star } from "lucide-react";
import type { RatingStats } from "@/lib/meditation/ratings";
import {
  formatAverage,
  hasRatings,
  ratingSummaryLabel,
} from "@/lib/meditation/rating-display";
import { cn } from "@/lib/utils";

/**
 * A meditation's average and count, "★ 4.6 (128)", for a card's meta line
 * and the meditation page. Nothing when there are no ratings, unless `empty`
 * gives the words to say so (the meditation page's "No ratings yet").
 */
export function RatingSummary({
  stats,
  empty,
  className,
}: {
  stats: RatingStats | null | undefined;
  empty?: string;
  className?: string;
}) {
  if (!hasRatings(stats)) {
    return empty ? <span className={className}>{empty}</span> : null;
  }

  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      <span className="sr-only">{ratingSummaryLabel(stats)}</span>
      <Star aria-hidden className="size-3 shrink-0 fill-current text-primary" />
      <span aria-hidden>
        {formatAverage(stats.average)} ({stats.count})
      </span>
    </span>
  );
}
