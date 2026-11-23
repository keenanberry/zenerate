import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, dismissalCookie, dismissalValue, isDismissed, readCookie } from "./dismissal";

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

  it("shows it for a value that is not a time", () => {
    expect(isDismissed("yes", now)).toBe(false);
    expect(isDismissed("-5", now)).toBe(false);
  });

  it("allows a phone clock up to a day ahead of the server's, and no further", () => {
    expect(isDismissed(dismissalValue(now + 5 * 60 * 1000), now)).toBe(true);
    expect(isDismissed(dismissalValue(now + DAY), now)).toBe(true);
    expect(isDismissed(dismissalValue(now + DAY + 1), now)).toBe(false);
  });
});

describe("dismissalCookie", () => {
  it("lasts 30 days on every path, Secure over https", () => {
    expect(dismissalCookie(now, true)).toBe(
      `zenerate-install-dismissed=${now}; Max-Age=2592000; Path=/; SameSite=Lax; Secure`,
    );
    expect(dismissalCookie(now, false)).not.toContain("Secure");
  });
});

describe("readCookie", () => {
  it("finds one cookie among several, or null", () => {
    const jar = `a=1; zenerate-install-dismissed=${now}; b=2`;
    expect(readCookie(jar, "zenerate-install-dismissed")).toBe(String(now));
    expect(readCookie(jar, "c")).toBeNull();
    expect(readCookie("", "a")).toBeNull();
    expect(isDismissed(readCookie(jar, "zenerate-install-dismissed"), now + DAY)).toBe(true);
  });
});
