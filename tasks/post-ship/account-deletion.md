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
`user_id` FK). It does **not** touch the `meditation-audio` bucket: objects there are
keyed `<meditation_id>.mp3` and nothing links them to the user row. A deletion that only
calls `auth.admin.deleteUser` leaves every audio file behind, which breaks the policy's
promise.

**Until this ships, a manual deletion must do both:** list the user's meditation ids,
remove `<id>.mp3` for each from the bucket, *then* delete the user.

## Scope sketch
- A server action, run with the service-role client after confirming the session
  matches the account: collect meditation ids, remove the storage objects, then
  `auth.admin.deleteUser`. Storage first, so a failure leaves a retryable account
  rather than orphaned files.
- A confirmation step in the UI (type the email, or similar).
- Data export (`/privacy` also promises access and export) could share the same
  settings surface. See `user-profiles.md`.
