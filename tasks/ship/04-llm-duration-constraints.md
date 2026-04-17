# LLM Duration Constraints

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
When a user requests a long meditation (30 min, 60 min), Claude currently tends to fill the time with continuous speech rather than using appropriate silence/pause blocks. Result: a 60-minute "meditation" that's a wall of narration — exhausting and not meditative. Also bloats ElevenLabs cost linearly with speech length.

## Acceptance criteria
- [ ] System prompt in `src/lib/ai/` instructs Claude on duration-based speech density
- [ ] Heuristic encoded: for meditations >15 min, speech should be roughly 30-50% of total time, with the rest as `*[SILENCE: N minutes]*` blocks
- [ ] For meditations >30 min, even sparser: 15-25% speech, long silence blocks (5-10 min each)
- [ ] Prompt gives explicit examples of what a 5 min vs 30 min vs 60 min meditation structure should look like
- [ ] Test: generate meditations at 5 / 15 / 30 / 60 min and verify structure feels right (manual listen-through or at least structure inspection)
- [ ] Estimated speech duration function exists somewhere (even as a rough `chars / speech_rate_cps`) so we can validate the output matches the requested duration ±20%

## Implementation notes
- Current prompt lives wherever `src/lib/ai/` handles generation — locate and extend.
- Consider adding a post-generation validator: parse output with `src/lib/meditation/parser.ts`, sum estimated segment durations, warn or reject if far from target.
- ElevenLabs speaks at roughly 150 words/min — useful rule of thumb for estimation.
- Don't hard-reject — warn and let the user accept, or re-prompt once. Hard rejections frustrate users.

## Open questions
- Should we expose "speech density" as a user-facing knob (e.g., "more guidance" vs "more silence"), or keep it fully implicit from duration?
