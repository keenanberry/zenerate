import { describe, expect, it } from "vitest";
import {
  formatAverage,
  hasRatings,
  promptDismissedKey,
  ratingSummaryLabel,
  reachedEnd,
  shouldPrompt,
} from "./rating-display";

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
