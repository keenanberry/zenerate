# Self-Serve Account Deletion

**Status:** Not started
**Priority:** Post-ship

## Why it matters
The Privacy Policy (`/privacy`, task 15) promises that deleting an account removes the
account data, meditations, **generated audio**, collections and usage records. Today the
only route is emailing `privacy@zeneratestudio.com`. GDPR's right to erasure is met by
that email path, but a self-serve button is the expected UX.

## The trap: storage does not cascade
Deleting the `auth.users` row cascades every `public` table (`on delete cascade` on each
`user_id` FK). It does **not** touch the `meditation-audio` bucket. A deletion that only
calls `auth.admin.deleteUser` leaves every audio file behind, which breaks the policy's
promise.

Since task 32, audio is laid out one folder per user:
`<user_id>/<meditation_id>/<render_id>.mp3`, archived versions included. Deleting a user's
audio is listing their prefix and removing what it returns. Storage `list` is one level
deep, so list `<user_id>/` for the meditation folders, then each folder for its files.
Audio rendered before task 32 sat at the bucket root as `<meditation_id>.mp3` (the bucket
was wiped on 2026-10-21, so production should hold none), and is found through the user's
meditation ids.

**Until this ships, a manual deletion must do both:** remove everything under the user's
prefix (plus any root-level `<meditation_id>.mp3` of theirs), *then* delete the user.
`docs/runbooks/operator-data-wipe.md` has the queries.

## Scope sketch
- A server action, run with the service-role client after confirming the session
  matches the account: remove everything under the user's storage prefix, then
  `auth.admin.deleteUser`. Storage first, so a failure leaves a retryable account
  rather than orphaned files.
- A confirmation step in the UI (type the email, or similar).
- Data export (`/privacy` also promises access and export) could share the same
  settings surface. See `user-profiles.md`.
