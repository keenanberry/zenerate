# Narration on ElevenLabs v3

**Status:** Not started
**Priority:** Post-ship. An exploration, not a fix: the current narration is good.
**Related:** #161 (counts get real pauses), #162 (request stitching, count runs, the
silent-clip check), `src/lib/audio/generate-audio.ts`, `src/lib/audio/stitching.ts`,
`src/lib/audio/count-runs.ts`, the `audio-pipeline` skill

## Why it might be worth it

`eleven_v3` is ElevenLabs' most expressive model. It takes inline audio cues
(`[whispers]`, `[sighs]`, `[softly]`, and so on) and is better at emotional delivery,
which suits a slow, close, bedtime voice. The operator's own words after #162 shipped:
"I don't think it'll ever be perfect, but it's pretty great. Maybe one day we can play
around with v3."

## What today's pipeline relies on that v3 may not support

Measured or decided in the #161/#162 listening rounds (2026-11-23):

- **Pause tags.** Count runs (3+ one-number lines with PAUSEs of 1–3 s) are sent as one
  request with `<break time="Ns" />` between the numbers (`count-runs.ts`). This fixed
  the odd pitch on single-word requests (every per-number render had one bad number;
  one came back near-silent). ElevenLabs documents break tags for
  `eleven_multilingual_v2`, Turbo and Flash; v3 does not support them and uses
  punctuation and audio cues instead. Breaks also shorten once a request carries more
  than about 18 s of them, which is why runs split at 10 beats / 18 s.
- **Request stitching.** Each speech request sends up to 3 `previous_request_ids`, so
  the voice continues across pauses instead of restarting like a new speaker. The
  operator chose this (P3) over `previous_text` / `next_text` (slowed delivery, added
  about 1.3–1.6 s of trailing silence per line). Check whether v3 accepts request ids.
- **Voice settings.** Production runs stability 0.5, similarity 0.75, style 0,
  speed 0.85. v3's settings behave differently and need their own tuning.
- **The voice.** Brittney, from the operator's "Zenerate" voice collection. Check that
  it is available and sounds the same on v3.

## Scope sketch

1. A listening round like #161/#162's: the same opening line, 10-to-1 countdown and
   five-line body-scan passage, rendered on v2 (today) and v3, through the same
   FFmpeg assembly. Keep characters to a few thousand. The operator listens; the
   worker measures beats, pause lengths and per-number pitch.
2. If v3 wins: decide how counts are paced without break tags (back to one number per
   request with stitching, or punctuation-only, both of which had problems on v2), and
   whether the studio agent should write v3 audio cues (that is a prompt and parser
   change, and the cues must never reach the script viewer as text).
3. Any change to `generate-audio.ts` or what it imports means a new sandbox snapshot
   (the `audio-pipeline` skill has the loop).

## Decisions to make

- Whether v3's expressiveness is worth losing break-tag pacing, or whether a hybrid
  (v2 for count runs, v3 for prose) sounds consistent enough.
- Cost: compare v3's per-character price with `eleven_multilingual_v2` on the
  operator's plan before switching.
