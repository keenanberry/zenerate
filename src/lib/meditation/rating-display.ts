import type { RatingStats } from "@/lib/meditation/ratings";

/**
 * What the rating UI (card ZEN-6) decides without a browser: when a listen
 * counts as finished, whether to ask for a rating, and how an average reads.
 * The components import these so the rules can be tested in node.
 */

/** A listen this far through counts as finished, as does the `ended` event. */
export const PROMPT_AT_FRACTION = 0.9;

export function reachedEnd(currentTime: number, duration: number): boolean {
  return duration > 0 && currentTime >= duration * PROMPT_AT_FRACTION;
}

/**
 * Ask only a listener who may rate (signed in, not the owner, a public and
 * finished meditation), has not rated it, has not said "Not now" this
 * session, and has reached the end.
 */
export function shouldPrompt({
  canRate,
  stars,
  dismissed,
  finished,
}: {
  canRate: boolean;
  stars: number | null;
  dismissed: boolean;
  finished: boolean;
}): boolean {
  return canRate && stars === null && !dismissed && finished;
}

/** "Not now" holds for the browser session, per meditation. */
export function promptDismissedKey(meditationId: string): string {
  return `zenerate:rating-prompt-dismissed:${meditationId}`;
}

/** 4.6, always one decimal: 5 reads as "5.0". */
export function formatAverage(average: number): string {
  return average.toFixed(1);
}

/** The summary's accessible text, e.g. "Rated 4.6 out of 5 by 128 listeners". */
export function ratingSummaryLabel({ average, count }: RatingStats): string {
  return `Rated ${formatAverage(average)} out of 5 by ${count} ${count === 1 ? "listener" : "listeners"}`;
}

/** The stats worth showing: a summary with no ratings shows nothing on a card. */
export function hasRatings(stats: RatingStats | null | undefined): stats is RatingStats {
  return !!stats && stats.count > 0;
}
