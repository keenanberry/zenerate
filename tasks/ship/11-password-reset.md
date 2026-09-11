# Password Reset Flow

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
Any user who forgets their password is permanently locked out — there's no recovery path. Supabase supports `resetPasswordForEmail` out of the box, but the UI flow doesn't exist.

## Acceptance criteria
- [ ] `/forgot-password` page with email input, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- [ ] `/reset-password` page with new-password form, validates + calls `supabase.auth.updateUser({ password })` when user arrives from the email link
- [ ] "Forgot password?" link visible on the `/login` page
- [ ] Email template configured in Supabase (production project) with the correct redirect URL
- [ ] End-to-end test in dev: request reset → receive email (Supabase local inbucket on `http://127.0.0.1:54324`) → click link → land on reset page → set new password → sign in with new password
- [ ] Same E2E test verified in production after tasks 07, 08 and 09 complete
- [ ] Rate limiting on the reset request endpoint (Supabase default may be enough — verify)

## Implementation notes
- The reset link from Supabase includes a `code` query param that is exchanged for a session on the reset page. Handle via `supabase.auth.exchangeCodeForSession` or via the auth helpers.
- Both pages should live under `src/app/(auth)/` since they're public.
- Update Supabase auth settings (production) to include the reset redirect URL in the allowlist.
- Keep success messaging generic ("If an account exists for that email, a reset link has been sent") to avoid leaking account existence.

## Open questions
- Magic link sign-in as a parallel option (no password at all)? Post-ship, not required for first ship.
