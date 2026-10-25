# Public Content Moderation

**Status:** Minimal slice shipped as task 53 (2026-10-25); the rest not started
**Priority:** Post-ship. A minimal Report link was promoted to ship task 53 on 2026-10-23

## Shipped in task 53
- **Report** in a public meditation's "…" menu, for anyone but the owner, signed in or
  not (`src/components/meditation-menu.tsx`). It is a mailto to `privacy@zeneratestudio.com`
  with the title and URL prefilled (`src/lib/meditation/report.ts`); no table, no reasons
  enum, nothing stored by the app.
- `/terms` ("Be decent") says how to report and that the operator reviews by hand.
- The operator unlists by hand with SQL; the statement is in `tasks/OPERATOR-TODO.md`.

Everything under the scope sketch below is still open. When the in-app report replaces
the mailto, the `/terms` sentence changes with it.

## Why it matters
`/discover` shows any user's meditation marked `is_public`. Right now there's no way to report abusive/inappropriate content, no way for the operator to review it, and no automated filter. Fine at zero users, problematic once there are any.

## Scope sketch
- **Report button** on public meditation pages — any signed-in user can flag with a reason (spam, inappropriate, copyright, other)
- **Reports table** in Supabase, joining `meditation_id`, `reporter_user_id`, `reason`, `created_at`, `status` (open/reviewed/actioned/dismissed)
- **Admin review queue** (ties into `admin-dashboard.md`) — list of open reports with links to the content, actions: dismiss, unlist (make private), delete
- **Auto-unlist threshold** — e.g., 3+ reports → automatically hide from `/discover` pending review
- **Appeal flow** — user gets an email if their content is actioned, with an appeal option (can be a simple mailto link for v1)

## Key decisions to make
- Pre-publish moderation (LLM-based content classifier before `is_public = true`) vs. reactive only? Pre-publish is more robust, adds cost + latency.
- Do we also moderate private meditations? (Default: no — they're only visible to the creator.)

## Implementation notes
- Simple classifier via Anthropic: prompt Claude with "classify this meditation content as safe/borderline/unsafe and explain." Cheap enough to run on every publish.
- If adding pre-publish filter, do it async after save — don't block the user's save flow on the classification.
- Keep report reasons as an enum in the DB, not free-text, to enable triage.
