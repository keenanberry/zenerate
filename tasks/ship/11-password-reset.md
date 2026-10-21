# Password Reset Flow

**Status:** Done locally; production E2E and dashboard steps are the operator's (see Outcome)
**Priority:** Ship-blocker

## Why this blocks ship
Any user who forgets their password is permanently locked out — there's no recovery path. Supabase supports `resetPasswordForEmail` out of the box, but the UI flow doesn't exist.

## Acceptance criteria
- [x] `/forgot-password` page with email input, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- [x] `/reset-password` page with new-password form, validates + calls `supabase.auth.updateUser({ password })` when user arrives from the email link
- [x] "Forgot password?" link visible on the `/login` page
- [ ] Email template configured in Supabase (production project) with the correct redirect URL *(template is in from task 08; the redirect allowlist entry is an operator step, see Outcome)*
- [x] End-to-end test in dev: request reset → receive email (Supabase local inbucket on `http://127.0.0.1:54324`) → click link → land on reset page → set new password → sign in with new password
- [ ] Same E2E test verified in production after tasks 07, 08 and 09 complete
- [x] Rate limiting on the reset request endpoint (Supabase default may be enough — verify)

## Implementation notes
- The reset link from Supabase includes a `code` query param (confirmed in task 11: the template's `{{ .ConfirmationURL }}` is a `/auth/v1/verify?token=pkce_…` link that redirects to `redirectTo` with `?code=`) that is exchanged for a session on the reset page. Handle via `supabase.auth.exchangeCodeForSession` or via the auth helpers.
- Both pages should live under `src/app/(auth)/` since they're public.
- Update Supabase auth settings (production) to include the reset redirect URL in the allowlist.
- Keep success messaging generic ("If an account exists for that email, a reset link has been sent") to avoid leaking account existence.

## Open questions
- Magic link sign-in as a parallel option (no password at all)? Post-ship, not required for first ship.

## Outcome

**What was built**
- `/forgot-password` (`src/app/(auth)/forgot-password/page.tsx`): email form calling
  `resetPasswordForEmail(email, { redirectTo })`. It ignores the result and always shows
  "If an account exists for that email, a reset link has been sent."
- `/reset-password` (`src/app/(auth)/reset-password/`): a server page that reads the session
  the callback created and renders the new-password form (password + confirm, min 6, matching
  the login rule), which calls `updateUser({ password })` and goes to `/dashboard`, signed in.
  With no session, or `?error=expired`, it shows "This link has expired" with a "Send a new
  link" button.
- "Forgot password?" link beside the Password label on `/login` (sign-in mode only).
- `src/components/auth-card.tsx`: the 28rem brand card, now shared by login and both new
  pages, so all three stay identical.
- `src/lib/auth/redirect.ts` (+ tests): `resetPasswordRedirectUrl()` and `safeNextPath()`.
- `/forgot-password` and `/reset-password` added to the `robots.ts` disallow list beside `/login`.

**What the template sends, and the redirect target.** `supabase/templates/recovery.html`
links to `{{ .ConfirmationURL }}`. Verified locally, that is
`<supabase>/auth/v1/verify?token=pkce_…&type=recovery&redirect_to=<redirectTo>`. Because the
browser client uses PKCE, `/verify` redirects to `redirectTo` with `?code=`, never a
`token_hash`, so the flow handles exactly `code`. `redirectTo` is
`<origin>/auth/callback?next=/reset-password`. The existing callback exchanges the code
(the verifier cookie set by `resetPasswordForEmail` is in the same browser) and forwards to
`/reset-password`. A reused or expired link comes back from `/verify` as
`?error=access_denied&error_code=otp_expired&next=/reset-password`, and the callback now sends
that to `/reset-password?error=expired`.

**Bugs found and fixed in the callback**
- Next dev reports `request.url` as `localhost` even when the browser is on `127.0.0.1`, so
  the callback redirected to a host where the session cookie it had just set does not exist
  (the visitor arrived signed out). It now takes the host from the `Host` header. Signup
  confirmation goes through the same route, so it had the same bug in dev.
- `next` was concatenated unchecked; `safeNextPath()` now accepts only a same-origin path.

**Local allowlist.** GoTrue accepts any port on `site_url`'s host (`127.0.0.1`), but a
`localhost` origin is not allowlisted and is silently rewritten to `site_url`, losing the
code. `supabase/config.toml` now adds `http://localhost:3000/**`. It takes effect on the next
`supabase start`; I did not restart the shared stack, so that line is untested.

**Evidence (local, headless Chromium in its own context, dev server on 127.0.0.1:3011, mail
read from Mailpit at :54324).** Fresh user → login → "Forgot password?" → submit → generic
message → email "Reset your Zenerate password" with the `pkce_` verify link → link →
`/reset-password` showing the account → mismatched confirm rejected → save → `/dashboard`.
The same link again → expired state. New browser: old password → "Invalid login
credentials", new password → `/dashboard`. Unknown address: same message, zero emails.

**Rate limiting.** Supabase enforces it on `/recover` itself: a second request for the same
account inside `max_frequency` returns `429 over_email_send_rate_limit` (seen in the local
auth log), on top of the project's per-hour email limit. That 429 only fires for addresses
with an account, which is why the form ignores every error. The production numbers are the
operator's to confirm (below).

**Decisions**
- Code exchange stays in the existing `/auth/callback` route rather than a second exchange
  inside `/reset-password`, so there is one place that turns an email code into a session.
- Anyone already signed in can open `/reset-password` and change their password. This is
  no wider than `updateUser` already allows a signed-in user anywhere, so I did not add a
  recovery-only marker.
- Screenshots were taken in an isolated headless context, not the shared Chrome profile: auth
  cookies are per host, not per port, so finishing a reset there would have swapped the
  signed-in user under other workers.

**For the operator (production)**
- Supabase → Authentication → URL Configuration → Redirect URLs: add
  `https://www.zeneratestudio.com/auth/callback**`. The host already matches the Site URL, which
  GoTrue accepts, but an explicit entry keeps it working if the Site URL changes. Add the apex or
  preview hosts too if resets should work from them; otherwise GoTrue falls back to the Site URL
  and the code is lost.
- Supabase → Authentication → Rate Limits: confirm the email-send limit and the per-user
  resend interval are set to what you want for launch.
- Production E2E (criterion above): request a reset for a real inbox, open the Resend email
  in the same browser, set a new password, sign in with it.

