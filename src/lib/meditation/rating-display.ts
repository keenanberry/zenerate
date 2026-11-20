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
 * session, has actually listened (a counted play, so a seek to the end is
 * not asked) and has reached the end.
 */
export function shouldPrompt({
  canRate,
  stars,
  dismissed,
  listened,
  finished,
}: {
  canRate: boolean;
  stars: number | null;
  dismissed: boolean;
  /** A play passed the listening threshold (watchPlays) on this page. */
  listened: boolean;
  finished: boolean;
}): boolean {
  return canRate && stars === null && !dismissed && listened && finished;
}

export type PromptPhase = "idle" | "shown" | "done";

/**
 * The prompt's next phase on this page. It asks at most once, and never
 * after the listener has had a rating on this page: clearing one (or a
 * rating saved from the page stars) is a choice, not a reason to ask.
 * `isDismissed` reads storage, so it runs only when the prompt would show.
 */
export function nextPromptPhase(
  phase: PromptPhase,
  inputs: Omit<Parameters<typeof shouldPrompt>[0], "dismissed">,
  isDismissed: () => boolean,
): PromptPhase {
  if (phase !== "idle") return phase;
  if (inputs.stars !== null) return "done";
  if (!shouldPrompt({ ...inputs, dismissed: false })) return "idle";
  return isDismissed() ? "done" : "shown";
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
