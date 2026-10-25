/**
 * Plain sentences for what can go wrong while signing in. Supabase's own messages
 * ("Token has expired or is invalid", "Signups not allowed for otp") are written for
 * developers, so the login page never shows them.
 */

export const SIGNUPS_CLOSED =
  "Zenerate isn't open to new accounts yet. If you already have one, sign in with the email it uses.";

const WRONG_CODE =
  "That code is wrong or has expired. Check the newest email from Zenerate, or send a new code.";
const RATE_LIMITED =
  "Too many codes have been sent. Wait a few minutes, then try again.";
const WRONG_PASSWORD = "That email and password don't match.";
const INVALID_EMAIL = "That doesn't look like an email address.";
const UNCONFIRMED =
  "This email isn't confirmed yet. Continue with email to get a code.";
const ALREADY_REGISTERED =
  "There's already an account with this email. Sign in instead.";
const GENERIC = "Something went wrong. Try again in a moment.";

/** The fields of a Supabase `AuthError` this cares about. */
type AuthErrorLike = { code?: string; status?: number; message?: string };

export function authErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as AuthErrorLike;
  switch (code) {
    case "otp_expired":
      return WRONG_CODE;
    case "signup_disabled":
    case "email_provider_disabled":
      return SIGNUPS_CLOSED;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return RATE_LIMITED;
    case "invalid_credentials":
      return WRONG_PASSWORD;
    case "email_address_invalid":
      return INVALID_EMAIL;
    case "email_not_confirmed":
      return UNCONFIRMED;
    case "user_already_exists":
    case "email_exists":
      return ALREADY_REGISTERED;
  }
  if (status === 429) return RATE_LIMITED;
  return GENERIC;
}

/** What `/auth/callback` passes back to `/login` as `?error=` when a sign-in fails. */
export type LoginErrorKind = "google-cancelled" | "signups-closed" | "google-failed" | "link-failed";

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorKind, string> = {
  "google-cancelled": "Google sign-in was cancelled. Try again, or continue with email.",
  "signups-closed": SIGNUPS_CLOSED,
  "google-failed": "Google sign-in didn't work. Try again, or continue with email.",
  "link-failed": "That sign-in didn't work. Try again, or continue with email.",
};

export function loginErrorMessage(kind: string | null): string | null {
  return kind && Object.hasOwn(LOGIN_ERROR_MESSAGES, kind)
    ? LOGIN_ERROR_MESSAGES[kind as LoginErrorKind]
    : null;
}

/**
 * Supabase sends a failed OAuth sign-in back to the redirect URL with `error`,
 * `error_code` and `error_description` in the query. A person backing out of Google's
 * consent screen comes back as `access_denied`; closed signups as `signup_disabled`.
 */
export function callbackErrorKind(params: URLSearchParams): LoginErrorKind | null {
  const error = params.get("error");
  const code = params.get("error_code");
  if (!error && !code) return null;
  if (code === "signup_disabled") return "signups-closed";
  if (error === "access_denied") return "google-cancelled";
  return "google-failed";
}
