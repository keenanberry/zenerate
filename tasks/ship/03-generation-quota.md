# Generation Quota (Audio)

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
ElevenLabs TTS is the dominant per-meditation cost (~$0.30 for a typical meditation, more for long ones). Without a per-user monthly cap, a single curious or malicious user can run up hundreds of dollars in charges in minutes. Script generation (Anthropic) is cheap enough to not worry about yet.

## Scope
Limit to **3 audio generations per user per calendar month** for the free tier. Post-ship paid tier (see `tasks/post-ship/paid-tier.md`) lifts this.

## Acceptance criteria
- [ ] Schema: track monthly audio generation count per user — either a `usage` table keyed `(user_id, year_month)` or a denormalized counter on a `user_profiles` row with reset timestamp
- [ ] `/api/audio/generate` increments the count atomically on successful workflow trigger (not on completion — we pay for TTS on attempt, plus retries shouldn't be free)
- [ ] Request returns HTTP 429 + clear error message when the user has hit the cap
- [ ] `generate-audio-panel.tsx` surfaces remaining quota ("2 of 3 this month") and disables the button when exhausted
- [ ] Failed generations (pipeline error) either don't count OR the user can explicitly "retry for free" — pick a policy and document it
- [ ] Quota displays somewhere obvious on the dashboard so users aren't surprised

## Implementation notes
- Prefer a `usage_events` append-only table over a counter — easier to audit, supports future paid-tier analytics, no race conditions on increments.
- Use `year_month` derived column (`to_char(created_at, 'YYYY-MM')`) for efficient monthly aggregation.
- Keep check + increment in a server action / route handler (service role client) so RLS doesn't need to permit self-writes.
- Anthropic script regeneration is unmetered for now — revisit if abuse appears.

## Open questions
- Refund policy on failed audio generation: retry free vs. counts against quota?
- Do we want a hard cap across ALL users (circuit breaker on total monthly spend) in addition to per-user? Probably yes for v1 — a flag/env var that lets you kill the feature if costs run wild.
