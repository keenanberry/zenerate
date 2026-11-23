/**
 * "Not now" on the Library's install card hides it on this device for 30
 * days. What is stored is the time of the dismissal, in epoch milliseconds,
 * under one localStorage key; these functions are the pure part.
 */
export const DISMISS_KEY = "zenerate:install-card-dismissed-at";
export const DISMISS_DAYS = 30;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

/** The value to store when the card is dismissed at `now`. */
export function dismissalValue(now: number): string {
  return String(Math.floor(now));
}

/**
 * Whether a stored value still hides the card at `now`. Nothing stored, a
 * value that is not a time, a dismissal 30 days old or a time in the future
 * (a clock set back, or a bad write) all show it again.
 */
export function isDismissed(stored: string | null, now: number): boolean {
  if (!stored || !/^\d+$/.test(stored)) return false;
  const elapsed = now - Number(stored);
  return elapsed >= 0 && elapsed < DISMISS_MS;
}
