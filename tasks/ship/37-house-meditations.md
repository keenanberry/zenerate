# House Meditations (Seeding)

**Status:** Not started
**Priority:** Phase 6. Run by the operator; agents assist.
**Phase:** 6 (seed & open)
**Depends on:** Wave A (27–31) in production. 32–36 are not required to start.
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

`/discover` can't launch with empty categories or rows of one. The operator makes 24 good
meditations through the new chat before signups open, which is also the first real test
of the studio.

## Scope

- **Before seeding:** run `docs/runbooks/operator-data-wipe.md`. Done by the operator
  2026-10-21; migrations deploy through the Supabase GitHub integration on merge.
- **Exemption:** set `QUOTA_EXEMPT_USER_IDS` to the operator's user id in Vercel
  Production, and redeploy.
- **Credits:** check the ElevenLabs balance. 24 × ~930 characters ≈ 22k credits, most of
  one Starter month. Use October's credits if Wave A is live in time; otherwise use
  November's. No rush.
- **Coverage:** 3 per `DISCOVER_CATEGORIES` entry, 24 in all. Vary voice, length (5 to
  30 minutes) and type, so filters return something.
- Set each one public, and mark 6 to 8 of the best as `is_featured` in SQL. They feed
  Popular and Picked for you until real counts exist.
- **Keep notes while seeding:** every moment the agent asked an unneeded question,
  missed the duration, picked the wrong tags, or felt slow. File them as issues, since
  they're the studio's first real feedback.
- If any meditation was made before tags existed, run a one-off backfill. This is not
  expected, because 29 ships the vocabulary.

## Acceptance criteria

- [ ] 24 public meditations in production, at least 3 per category, all with a title,
  description, 2 to 5 tags, and audio.
- [ ] 6 to 8 marked `is_featured`.
- [ ] The issues from the seeding notes are filed.
