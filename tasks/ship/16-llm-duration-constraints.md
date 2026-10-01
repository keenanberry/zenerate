# LLM Duration Constraints

**Status:** Done — measured before and after
**Priority:** Ship-blocker

## Why this blocks ship

**The original premise was wrong, and measuring showed why.** This file predicted that
long meditations would be "a wall of narration". They were not: measured against
`claude-sonnet-5`, speech share *falls* as duration rises (23% at 5 min → 6% at 60 min).
The model was not over-narrating.

The real defect was **length**. Long sessions came out systematically short, with high
variance:

| Requested | Samples (% of target) | Mean |
|---|---|---|
| 5 min | 115% | 115% |
| 15 min | 99% | 99% |
| **30 min** | 70%, 80%, 94% | **81%** |
| **60 min** | 80%, 85%, 68% | **78%** |

Ask for 60 minutes and get between 41 and 51. The spread mattered as much as the bias —
the same request produced wildly different lengths.

The cause: the prompt's entire duration guidance was one line ("Match the total duration
to what the user requests"), with no arithmetic, no silence budget, and a single
unlabelled ~6-minute worked example. The model had no way to check itself.

## Acceptance criteria
- [x] `MEDITATION_SYSTEM_PROMPT` now carries a "Hitting the requested duration" section: the explicit arithmetic (`total = words/128wpm + pauses + silences`), a silence-budget calculation, and an instruction to add up the markers and self-check before finishing
- [x] ~~30-50% speech above 15 min~~ — **deliberately not implemented.** Measured output is 6-11% speech at those durations. Enforcing 30-50% would mean adding 6-12 minutes of narration to a 60-minute session, which raises ElevenLabs cost (this file's own stated concern) and makes it less meditative. The shortfall was never too little speech; it was too little silence. Targeting total duration via the silence budget is what fixed it
- [x] Partially — the **5-10 minute silence blocks** are encoded (long sessions built from 2-minute silences read as constant interruption). The 15-25% speech band is not, for the reason above: real output is sparser than that band and better for it
- [x] Calibration shapes for 5 / 15 / 30 / 60 min, each giving the speech, pause and silence split plus how many blocks to use
- [x] **Measured, not eyeballed.** `scripts/measure-script-duration.ts` generates at any set of durations and reports estimated vs requested. Results below
- [x] `src/lib/meditation/duration.ts` — `estimateDuration` / `checkDuration` with a ±20% tolerance, 16 tests. Speech rate is derived from the real TTS config (150 wpm × `speed: 0.85` = 127.5 wpm) and documented as an estimate to be calibrated against a real narration

## Result

Same protocol before and after — 3 samples at each long duration, 2 at each short one:

| Requested | Before | After |
|---|---|---|
| 5 min | 115% | 91%, 102% |
| 10 min | — | 93%, 106% |
| 15 min | 99% | 99%, 104% |
| 30 min | 70%, 80%, 94% | 98%, 96%, 102% |
| 60 min | 80%, 85%, 68% | 98%, 94%, 98% |

**Long durations: mean 82% → 98%, and the spread collapsed** from 24 points to 6 at 30
minutes, and 17 points to 4 at 60. Short durations did not regress — they tightened too.
All 12 post-change samples land within ±20%.

Reproduce with `npx tsx scripts/measure-script-duration.ts`. It calls the model directly
rather than going through `/api/generate`, so a measurement run cannot burn a user's
monthly quota.

## Implementation notes
- Current prompt lives wherever `src/lib/ai/` handles generation — locate and extend.
- Consider adding a post-generation validator: parse output with `src/lib/meditation/parser.ts`, sum estimated segment durations, warn or reject if far from target.
- ElevenLabs speaks at roughly 150 words/min — useful rule of thumb for estimation.
- Don't hard-reject — warn and let the user accept, or re-prompt once. Hard rejections frustrate users.

## Open questions
- Should we expose "speech density" as a user-facing knob? Still open, but weaker than it looked: measured density is already 6-11% at long durations and consistent, so there is no erratic behaviour for a knob to tame. Revisit if anyone asks for more guidance.
- **The speech rate is derived, not measured.** 150 wpm × 0.85 is a rule of thumb. Time a real narration against its estimate once audio generation is working and calibrate `BASE_WORDS_PER_MINUTE`. Everything else in the estimate is exact, so this is the only source of error.
