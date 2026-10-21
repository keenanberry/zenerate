# Privacy Update + Open Signups

**Status:** Not started
**Priority:** Phase 6. The launch gate.
**Phase:** 6 (seed & open)
**Depends on:** 37, and every earlier phase's open items (10, 11, 15's forwarder, the 23/26 share cards)

## Why

Chats are new personal data, and `/privacy` has to say so before strangers arrive. Then
signups open, and there's no date: they open when this list is done.

## Scope

- **`/privacy`** (`src/app/(legal)/privacy/page.tsx`) says that conversations with the
  meditation agent are stored, are visible only to you even when a meditation is public,
  are sent to Anthropic to generate replies, and are deleted with your account. It also
  covers plays, which are recorded when signed in to rank Popular. Update the
  "Your content" list.
- **Confirm account deletion still reaches the new data:** chats and messages cascade
  from `auth.users`, and archived versions' audio objects need the same handling as
  current audio (`tasks/post-ship/account-deletion.md` gets a line).
- **Launch checklist, run by the operator:**
  - [ ] Phases 0–5 are Done (or Done* with only operator items left).
  - [x] 08's templates are pasted into production (2026-10-20).
  - [ ] 11's password reset pages are built and verified in production.
  - [ ] 10's cron run log is confirmed, and a production dump exists.
  - [ ] 15's `privacy@zeneratestudio.com` forwarder delivers to the operator.
  - [ ] The share-card checks from 23 and 26 pass.
  - [x] `NEXT_PUBLIC_SITE_URL` is set to the `www` host (2026-10-20).
  - [ ] **Supabase → Auth → enable signups.**

## Acceptance criteria

- [ ] The privacy page changes are reviewed by the operator.
- [ ] The checklist above is fully ticked, with dates.
