import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, dismissalValue, isDismissed } from "./dismissal";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 23, 12);

describe("isDismissed", () => {
  it("shows the card when nothing is stored", () => {
    expect(isDismissed(null, now)).toBe(false);
    expect(isDismissed("", now)).toBe(false);
  });

  it("hides it for 30 days after Not now", () => {
    const stored = dismissalValue(now);
    expect(isDismissed(stored, now)).toBe(true);
    expect(isDismissed(stored, now + DAY)).toBe(true);
    expect(isDismissed(stored, now + DISMISS_DAYS * DAY - 1)).toBe(true);
  });

  it("shows it again once 30 days have passed", () => {
    expect(isDismissed(dismissalValue(now), now + DISMISS_DAYS * DAY)).toBe(false);
  });

  it("shows it for a value that is not a time, or one in the future", () => {
    expect(isDismissed("yes", now)).toBe(false);
    expect(isDismissed("-5", now)).toBe(false);
    expect(isDismissed(dismissalValue(now + DAY), now)).toBe(false);
  });
});
