/** Where the password reset email's link lands once its code is exchanged. */
export const RESET_PASSWORD_PATH = "/reset-password";

/**
 * The `redirectTo` passed to `resetPasswordForEmail`. The recovery template links to
 * `{{ .ConfirmationURL }}`, which Supabase verifies and then redirects here with a PKCE
 * `code`; the callback route exchanges it and forwards to the reset page.
 */
export function resetPasswordRedirectUrl(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(RESET_PASSWORD_PATH)}`;
}

/** Accepts only a same-origin path, so `next` cannot send anyone off the site. */
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
