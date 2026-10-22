# Privacy Update + Open Signups

**Status:** In progress: code half done (PR #63); the operator's launch checklist remains
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

## Outcome

**Code half (2026-10-21).** `/privacy` now covers conversations with the agent, plays,
what a public meditation shows, earlier versions, and the new retention and deletion
promises. Its date is October 21, 2026. Each claim is cited claim → file:line in the PR
body. Checked on the production build in dark and light, at desktop width and at 390px:
it renders with no horizontal scroll, and `impeccable detect` reports nothing.

Checking the brief against the code turned up three gaps. The coordinator decided each one:

- **The chat's first message was public.** `writeScript` copied it into
  `meditations.prompt`, which anon can read on a public meditation. The fix: `writeScript`
  no longer writes `prompt` (`src/lib/chat/tools.ts`), `getMeditation` nulls `prompt` for
  non-owners, and the data-only migration `20261022000038_clear_studio_prompts.sql` clears
  the copies on meditations that have a chat. That was 25 rows locally, in a rolled-back
  dry run; the shared DB was left untouched. The landing page's unused `prompt` select is
  gone too.
- **Drafts are readable by anon through the REST API.** `draft_script` is a `meditations`
  column. The copy says only that drafts are "never shown on the meditation's page".
  The fix is filed as `38b-drafts-owner-only.md`, which blocks signups.
- **Nothing deletes a chat.** Deleting a meditation keeps its chat (`on delete set null`),
  and there is no chat delete. The copy says a conversation is kept until the account is
  deleted, and that you can email to delete one sooner. The fix is filed as
  `tasks/post-ship/chat-deletion.md`.

`tasks/post-ship/account-deletion.md` now lists chats and messages, plays, and archived
versions' audio. The backup promise (30 days) is unchanged, which keeps it consistent with
`backup-retention.md`.

**For the operator:** read the privacy copy before merge. Then run the launch checklist
above, which stays unticked, and land 38b before enabling signups.
