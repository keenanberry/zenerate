# Self-Serve Account Deletion

**Status:** Not started
**Priority:** Post-ship

## Why it matters
The Privacy Policy (`/privacy`, tasks 15 and 38) promises that deleting an account
removes the account data, meditations, **generated audio** (earlier versions included),
conversations with the meditation agent, favorites, collections, plays and usage records. Today the
only route is emailing `privacy@zeneratestudio.com`. GDPR's right to erasure is met by
that email path, but a self-serve button is the expected UX.

## What deletion must cover
Task 38 checked each piece against `supabase/migrations/20261021000000_studio_schema.sql`:

- **Chats and their messages:** `chats.user_id` cascades from `auth.users`, and
  `chat_messages.chat_id` cascades from `chats`. Deleting the user is enough.
- **Plays:** `meditation_plays.user_id` cascades from `auth.users` (the user's own
  listening), and `meditation_plays.meditation_id` cascades from `meditations` (others'
  plays of the user's meditations). Deleting the user is enough.
- **Archived versions:** the `meditation_versions` rows cascade through `meditations`, but
  their audio files do not. They sit in the same per-user folder as current audio, so the
  prefix delete below removes them.

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

**Until this ships, a manual deletion must do all three:** remove everything under the user's
prefix (plus any root-level `<meditation_id>.mp3` of theirs), *then* delete the user,
*then* record the deletion so a backup restore deletes them again
(`docs/runbooks/backup-restore.md`, "Deletion records"). A self-serve deletion needs a
record of its own that a restore cannot roll back, so not a row in the same database.
`docs/runbooks/operator-data-wipe.md` has the queries.

## Scope sketch
- A server action, run with the service-role client after confirming the session
  matches the account: remove everything under the user's storage prefix, then
  `auth.admin.deleteUser`. Storage first, so a failure leaves a retryable account
  rather than orphaned files.
- A confirmation step in the UI (type the email, or similar).
- Data export (`/privacy` also promises access and export) could share the same
  settings surface. See `user-profiles.md`.
