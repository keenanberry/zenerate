import { describe, expect, it } from "vitest";
import {
  formatAverage,
  hasRatings,
  nextPromptPhase,
  promptDismissedKey,
  ratedAgo,
  ratingCountLabel,
  ratingSummaryLabel,
  reachedEnd,
  shouldPrompt,
} from "./rating-display";

describe("nextPromptPhase", () => {
  const ready = { canRate: true, stars: null, listened: true, finished: true };
  const notDismissed = () => false;

  it("shows the prompt once the listener is ready to be asked", () => {
    expect(nextPromptPhase("idle", ready, notDismissed)).toBe("shown");
  });

  it("is done instead when they said Not now this session", () => {
    expect(nextPromptPhase("idle", ready, () => true)).toBe("done");
  });

  it("is done for good on this page once they have a rating, so clearing it does not ask again", () => {
    const rated = nextPromptPhase("idle", { ...ready, stars: 3 }, notDismissed);
    expect(rated).toBe("done");
    expect(nextPromptPhase(rated, ready, notDismissed)).toBe("done");
  });

  it("waits while the listen is not finished, and leaves a shown prompt alone", () => {
    expect(nextPromptPhase("idle", { ...ready, finished: false }, notDismissed)).toBe("idle");
    expect(nextPromptPhase("shown", { ...ready, stars: 4 }, notDismissed)).toBe("shown");
  });
});

describe("reachedEnd", () => {
  it("counts 90% through, or the end, as finished", () => {
    expect(reachedEnd(539, 600)).toBe(false);
    expect(reachedEnd(540, 600)).toBe(true);
    expect(reachedEnd(600, 600)).toBe(true);
  });

  it("is never finished before the duration is known", () => {
    expect(reachedEnd(0, 0)).toBe(false);
  });
});

describe("shouldPrompt", () => {
  const ready = { canRate: true, stars: null, dismissed: false, listened: true, finished: true };

  it("asks a listener who may rate, has not, and reached the end", () => {
    expect(shouldPrompt(ready)).toBe(true);
  });

  it("never asks the owner or a signed-out listener, someone who rated, after Not now, or before the end", () => {
    expect(shouldPrompt({ ...ready, canRate: false })).toBe(false);
    expect(shouldPrompt({ ...ready, stars: 4 })).toBe(false);
    expect(shouldPrompt({ ...ready, dismissed: true })).toBe(false);
    expect(shouldPrompt({ ...ready, finished: false })).toBe(false);
  });

  it("never asks someone who skipped to the end without listening", () => {
    expect(shouldPrompt({ ...ready, listened: false })).toBe(false);
  });
});

describe("display", () => {
  it("shows the average to one decimal", () => {
    expect(formatAverage(4.6)).toBe("4.6");
    expect(formatAverage(5)).toBe("5.0");
  });

  it("labels the summary for screen readers", () => {
    expect(ratingSummaryLabel({ average: 4.6, count: 128 })).toBe(
      "Rated 4.6 out of 5 by 128 listeners",
    );
    expect(ratingSummaryLabel({ average: 3, count: 1 })).toBe("Rated 3.0 out of 5 by 1 listener");
  });

  it("has ratings only with a count above zero", () => {
    expect(hasRatings(undefined)).toBe(false);
    expect(hasRatings(null)).toBe(false);
    expect(hasRatings({ average: 0, count: 0 })).toBe(false);
    expect(hasRatings({ average: 4, count: 2 })).toBe(true);
  });

  it("keys the dismissal per meditation", () => {
    expect(promptDismissedKey("a")).not.toBe(promptDismissedKey("b"));
  });
});

describe("ratingCountLabel", () => {
  it("says the count in words, shortening thousands", () => {
    expect(ratingCountLabel(1)).toBe("1 rating");
    expect(ratingCountLabel(128)).toBe("128 ratings");
    expect(ratingCountLabel(1000)).toBe("1k ratings");
    expect(ratingCountLabel(1250)).toBe("1.3k ratings");
    expect(ratingCountLabel(55_400)).toBe("55k ratings");
  });
});

describe("ratedAgo", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const daysBefore = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  it("reads as days, weeks, months, then years", () => {
    expect(ratedAgo(daysBefore(0), now)).toBe("Today");
    expect(ratedAgo(daysBefore(1), now)).toBe("Yesterday");
    expect(ratedAgo(daysBefore(3), now)).toBe("3 days ago");
    expect(ratedAgo(daysBefore(7), now)).toBe("1 week ago");
    expect(ratedAgo(daysBefore(20), now)).toBe("2 weeks ago");
    expect(ratedAgo(daysBefore(30), now)).toBe("1 month ago");
    expect(ratedAgo(daysBefore(200), now)).toBe("6 months ago");
    expect(ratedAgo(daysBefore(362), now)).toBe("11 months ago");
    expect(ratedAgo(daysBefore(400), now)).toBe("1 year ago");
    expect(ratedAgo(daysBefore(800), now)).toBe("2 years ago");
  });

  it("counts calendar days in the reader's time zone, not 24-hour spans", () => {
    const morning = new Date(2026, 10, 20, 8, 0);
    expect(ratedAgo(new Date(2026, 10, 19, 23, 0).toISOString(), morning)).toBe("Yesterday");
    expect(ratedAgo(new Date(2026, 10, 18, 23, 0).toISOString(), morning)).toBe("2 days ago");
    expect(ratedAgo(new Date(2026, 10, 20, 0, 5).toISOString(), morning)).toBe("Today");
  });

  it("treats a clock a little ahead of the server as today", () => {
    expect(ratedAgo(new Date(now.getTime() + 60_000).toISOString(), now)).toBe("Today");
  });
});
