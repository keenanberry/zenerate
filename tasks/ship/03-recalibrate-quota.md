# Recalibrate Generation Quota

**Status:** Done
**Priority:** Ship-blocker
**Depends on:** 06 (need the purchased ElevenLabs plan to derive from)
**History:** The quota system itself is **done** — spec at `docs/superpowers/specs/2026-04-25-generation-quota-design.md`, plan at `docs/superpowers/plans/2026-04-25-generation-quota.md`, shipped in `0e7b15f`. This task only adjusts its calibration.

## Why this blocks ship

`MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=500` was chosen before the ElevenLabs plan was.
Measured against real scripts it is ~17× too high:

| | |
|---|---|
| Measured speech per meditation (seeded scripts) | ~930 characters |
| 500 generations × 930 chars | ~465,000 credits/month |
| ElevenLabs plan that covers that | Pro, $99/mo |
| ElevenLabs plan actually purchased | Starter, $6/mo — 30,000 credits |
| Generations Starter actually covers | ~32 |

The circuit breaker exists to stop runaway spend. Set 17× above the real ceiling it can
never fire first — ElevenLabs cuts us off, the workflow fails mid-generation, and the
user sees a broken meditation instead of a clean "monthly limit reached".

## Acceptance criteria

- [ ] `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` set to **25** (Starter's ~32 minus headroom for retries and longer-than-average scripts)
- [ ] `.env.example` comment states the value is *derived from the ElevenLabs plan*, shows the arithmetic, and says to revisit on plan change
- [ ] Same note added wherever the constant is read in `src/lib/audio/quota.ts`
- [ ] `PER_USER_MONTHLY_AUDIO_LIMIT=3` left unchanged — still correct
- [ ] Production Vercel env matches (task 09)
- [ ] Verify the breaker actually fires: temporarily set the cap to 1 in local dev, attempt a second generation, confirm HTTP 429 and the UI message

## Implementation notes

- The measurement script used to derive ~930 chars is worth keeping — it parses `supabase/seed.sql`, strips marker lines, and counts speech characters. Re-run it against real production scripts after a month of use; user-written prompts may skew longer than the seeded examples.
- `generation_meta.tts_characters` is already captured per generation (`src/lib/audio/workflow.ts:104`). After launch, query the real distribution rather than re-estimating.
- Upgrading to Creator ($22/mo, 121k credits ≈ 120 generations) is the natural next step — at that point the cap becomes ~100.

## Open questions

- Should the cap be an env var at all, or computed from a `ELEVENLABS_MONTHLY_CREDITS` var plus the observed mean character count? The latter is self-correcting but more machinery than a side project needs. Default: keep the plain integer, document the derivation.
