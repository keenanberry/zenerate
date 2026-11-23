/**
 * "Not now" on the Library's install card hides it on this device for 30
 * days. It is a cookie, not localStorage, so the server can leave the card
 * out of the page instead of the client removing it after paint. The value
 * is the time of the dismissal in epoch milliseconds; these functions are the
 * pure part.
 */
export const DISMISS_COOKIE = "zenerate-install-dismissed";
export const DISMISS_DAYS = 30;
const DISMISS_SECONDS = DISMISS_DAYS * 24 * 60 * 60;
const DISMISS_MS = DISMISS_SECONDS * 1000;
/** How far ahead of the server's clock a dismissal may be: the phone's clock may run fast. */
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** The value to store when the card is dismissed at `now`. */
export function dismissalValue(now: number): string {
  return String(Math.floor(now));
}

/** The `document.cookie` assignment that records a dismissal at `now`. */
export function dismissalCookie(now: number, secure: boolean): string {
  return `${DISMISS_COOKIE}=${dismissalValue(now)}; Max-Age=${DISMISS_SECONDS}; Path=/; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/** One cookie's value from a `document.cookie` string, or null. */
export function readCookie(cookies: string, name: string): string | null {
  for (const part of cookies.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * Whether a stored value still hides the card at `now`. The phone writes the
 * time and the server reads it against its own clock, so a dismissal up to a
 * day in the future still counts (a phone clock running fast). Nothing stored,
 * a value that is not a time, a dismissal 30 days old or one further ahead (a
 * bad write) show the card again. The cookie expires on its own as well.
 */
export function isDismissed(stored: string | null | undefined, now: number): boolean {
  if (!stored || !/^\d+$/.test(stored)) return false;
  const elapsed = now - Number(stored);
  return elapsed >= -CLOCK_SKEW_MS && elapsed < DISMISS_MS;
}
