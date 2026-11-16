# House Meditations (Seeding)

**Status:** Done, launched thin by the operator's choice (2026-11-16). 16 public meditations,
6 featured; Sleep and Morning have one each
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
  description, 2 to 5 tags, and audio. Not met, and accepted: see Outcome.
- [x] 6 to 8 marked `is_featured`: 6.
- [x] The issues from the seeding notes are filed (operator, 2026-11-06).

## Outcome

Counted in production on 2026-11-16, public and completed only: 16 meditations, 6 featured,
every one with 2 to 5 tags. By Discover category (a meditation counts in each category
any of its tags belongs to, per `DISCOVER_CATEGORIES`): Sleep 1, Stress relief 3, Focus 7,
Morning 1, Kindness 8, Breath & body 8.

The operator chose to launch thin rather than make more: the first users' meditations
should fill Sleep and Morning, and Supabase Free's 1 GB of storage, which does not reset,
is better spent on theirs. Every category tile still opens to at least one meditation.
