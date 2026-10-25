# Sign In with Google or an Emailed Code

**Status:** Done* (PR #99, 2026-10-25). *Operator: create the Google client and switch the provider on; Google sign-in is untested end to end until then (see below)
**Priority:** Phase 6 (seed & open). Promoted from `tasks/post-ship/google-apple-auth.md`
on 2026-10-24, the Google half only, plus an emailed code.
**Phase:** 6
**Depends on:** nothing in code. The Google button needs the operator's Google Cloud OAuth
client and the provider switched on in Supabase (`tasks/OPERATOR-TODO.md` §2); build and
test locally first.

## Why

Signups open once Phase 6 is done, and today a first visitor must invent a password and
then, in production, confirm their email before they can write anything. That is the step
most of them abandon. Doing it now, while signups are closed, means no existing
password accounts need linking or migrating.

- **Google** covers most people in one tap. It is free and a built-in Supabase provider.
- **An emailed 6-digit code** covers everyone else, with no password and no third party.
  It is typed into the page, not followed as a link, so it also works in the installed
  iPhone app, where a redirect can open in Safari and sign the person in there instead.

Considered and left out (2026-10-24):
- **Apple** costs $99 a year, its key needs rotating, and "Hide my email" needs Resend
  registered with Apple's relay. It stays in `tasks/post-ship/google-apple-auth.md`.
- **Facebook** needs Meta business verification and a privacy review, and some people
  distrust it for something as personal as meditation.
- **Others** (Microsoft, Spotify, GitHub, Discord) fit too few of the people who would
  visit.

## Decisions

- **`/login` order:**
  1. **Continue with Google**
  2. **Continue with email**: enter an address, get a 6-digit code, type it in
  3. **Use a password instead**: the existing form, kept for the accounts that have one
     and as a fallback

  One page for signing in and signing up: Google and the code create the account if it
  does not exist. The password form keeps its own sign-up toggle.
- **Google** uses `supabase.auth.signInWithOAuth({ provider: "google", options: {
  redirectTo: <origin>/auth/callback?next=<next> } })`. The existing callback already
  exchanges the code and only follows same-origin `next` (ship 11), so it needs no change
  beyond a check. Basic scopes only (email, profile), so Google needs no app review.
- **The code** uses `signInWithOtp({ email, options: { shouldCreateUser: true } })`, then
  `verifyOtp({ email, token, type: "email" })` in the page. No `emailRedirectTo`: the
  email carries the code, so nothing depends on which browser opens a link.
- **Email templates.** Supabase sends **Magic Link** to an existing user and **Confirm
  signup** to a new one. Both must show `{{ .Token }}` as the main thing in the email. The
  existing `supabase/templates/confirmation.html` is link-based for password sign-up, so it
  either shows both the code and the link, or the password sign-up moves to the code too.
  The implementer chooses one and records it here. Add `supabase/templates/magic_link.html`
  and wire it in `supabase/config.toml`, in the house style of the two existing templates.
  Production pastes the same files into the dashboard (Authentication → Emails), as the
  comment in `config.toml` says.
- **Account linking.** Supabase links a Google identity to an existing account with the
  same verified email. That is the behaviour we want, so someone who signed up with a
  password and then taps Google lands in the same Library. Verify it locally.
- **Display name.** Nothing new is collected. The app has no display name today
  (`tasks/post-ship/user-profiles.md`), and Google's profile name is not shown anywhere.
- **Closed signups still hold.** With Supabase signups disabled, Google and the code sign
  in existing users only and refuse new ones. Show that refusal as a plain sentence, not a
  raw error.
- **Errors in words:** a wrong or expired code, too many requests (Supabase's rate limit),
  Google cancelled by the person, and signups closed.

### Chosen in the build (2026-10-25)

- **Templates: the password sign-up moved to the code too.** `confirmation.html` and the
  new `magic_link.html` both show `{{ .Token }}` and no link, so no email in the sign-in
  path depends on which browser opens it. With email confirmation on, a password
  sign-up goes straight to the code step on `/login`, and `verifyOtp({ type: "email" })`
  confirms it. Only the password reset (`recovery.html`) is still a link.
- **`[auth.external.google]` is committed with `enabled = false`.** The Supabase CLI cannot
  make `enabled` depend on the variables: `enabled = "env(...)"` fails to parse when the
  variable is unset, and `enabled = true` with an unset client id starts Supabase with a
  bogus client. To test Google locally, set both variables in `.env.local` and flip
  `enabled` locally (`.env.example` has the steps).
- **The Google button checks first.** With the provider off, Supabase answers the
  authorize redirect with a raw JSON page, so the button reads `/auth/v1/settings` and
  says "Google sign-in isn't available right now" instead of leaving.
- **Callback errors** come back to `/login?error=<kind>` (`google-cancelled`,
  `signups-closed`, `google-failed`, `link-failed`), keeping `next`. All sentences live
  in `src/lib/auth/errors.ts`. Supabase reports a wrong code and an expired one with the
  same error (`otp_expired`), so one sentence covers both.
- **`/privacy` differs from the spec on one point.** Supabase Auth keeps the name and
  picture URL Google sends in the account's identity record, so the page says the
  authentication provider keeps them and Zenerate uses only the email, rather than that
  only the email is stored.

## Scope

- `src/app/(auth)/login/page.tsx`: Google button, the email-code step (the email field,
  then a 6-digit input with `inputMode="numeric"` and `autoComplete="one-time-code"`, so
  iOS offers the code from Mail), the password form behind "Use a password instead".
  Follow `DESIGN.md` and the `zenerate-design` skill. Use Google's own "G" mark: the brand
  rules require it, and it is the one logo allowed here.
- `supabase/config.toml`: `[auth.external.google]` with
  `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` and
  `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, `enabled` only when both are set,
  and the Magic Link template.
- `.env.example`: the two local Google variables, commented as optional. Without them the
  Google button still renders and fails gracefully locally.
- `/privacy`: name Google as a sign-in option, what it shares (email, name, profile
  picture URL; the app stores the email only), and that the code is sent through the
  existing email provider. Update the last-updated date.
- `/terms`, if it describes how accounts are created.
- `tasks/OPERATOR-TODO.md`: the Google section exists; adjust it to what was built.
- `DESIGN.md`: a short Sign-in section for the new layout.

## Not in scope

Apple, any other provider, display names or avatars, and changing how password reset
works.

## Done when

- [ ] Locally, with a test Google client: a new Google account signs up and lands on
      `/dashboard`; an existing password account signs in with Google into the same
      Library; `next` is honoured; a cancelled consent returns to `/login` with a sentence.
      **Not done: no Google client was available.** Checked instead: with the provider
      off the button says so in a sentence; `/auth/callback` with `error=access_denied`,
      `error_code=signup_disabled` or another error lands on `/login` with the right
      sentence and keeps `next`. Account linking is unverified.
- [x] Locally, in Mailpit: a new address gets a code and signs up; an existing one signs
      in; a wrong code and an expired code each say so; resending is rate-limited with a
      sentence. (Expiry and the rate limit with `otp_expiry = 60` and `max_frequency =
      "60s"` set temporarily; `next` honoured for the code too.)
- [x] With signups disabled locally, the code refuses a new address with a sentence, and
      still signs in an existing one. (Google: the callback mapping only, as above.)
- [x] The password form still signs in and signs up, and with confirmation on a password
      sign-up confirms with the emailed code.
- [x] Dark, light and 390px wide, per the `zenerate-design` order.
- [x] `/privacy` names Google; the operator TODO and this file are current.
- [ ] Operator (`tasks/OPERATOR-TODO.md` §2 and §4): Google client created, provider on in
      Supabase, templates pasted, sign-in with Google and with a code checked in Safari and
      the installed iPhone app.
