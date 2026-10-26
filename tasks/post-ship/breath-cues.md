# Breath Cues

**Status:** Not started
**Priority:** Post-ship. A nice-to-have the operator raised while listening to finished
meditations (2026-10-25); nothing at launch depends on it.
**Related:** `src/lib/meditation/sounds.ts` (the sound catalog), `scripts/sound-effects.ts`
(how sounds are made and baked in), `src/lib/meditation/parser.ts` (script markers),
`src/lib/ai/prompts.ts` (what the model may write), the `audio-pipeline` skill.

## Why

When a script says "take a deep breath in", the listener hears the instruction and then
silence. An audible cue for the in-breath and the out-breath would carry them through it,
as breathwork apps do.

## The catch, and the approach

Breathwork varies: a plain deep breath, box breathing (4-4-4-4), 4-7-8, "in for six, out
for eight". A fixed-length sound cannot follow all of them. Scripts already carry timing in
markers (`*[PAUSE: 8 seconds]*`, `*[SOUND: bell-tibetan.mp3]*`), so a breath is one more
marker that carries its own direction and length:

```
Breathe in for four...
*[BREATH: in 4]*
Hold...
*[PAUSE: 4 seconds]*
And out for six...
*[BREATH: out 6]*
```

- Any rhythm is just different numbers. A hold is the existing `PAUSE`.
- The duration estimate keeps working, since every breath marker has a known length.
- The simplest build fits the existing catalog: a fixed set of lengths, in and out (for
  example 2–10 seconds each, about 18 files), rendered at snapshot build time like the
  synthesized bells. `BREATH: in 4` resolves to `breath-in-4.mp3`. Odd lengths round to the
  nearest file, or the marker is limited to the set and the prompt says so.
- Rendering at mix time instead (any length) is possible but means new code in
  `generate-audio.ts`; only worth it if the fixed set proves too coarse.

## The real risk: how it sounds

Not the code. Two candidates, to be heard side by side before anything is built:

1. **A breath:** soft filtered noise that swells over the in-breath and falls away over the
   out-breath. Risk: synthetic breath can read as eerie, and it sits next to an ElevenLabs
   voice that has its own breathing. Note `scripts/sound-effects.ts`: synthesis could not
   make a convincing gong, so the gongs are CC0 recordings. A breath may need the same
   route (a recording, time-stretched only within what stays natural).
2. **A guide tone:** a quiet tone that rises over the in-breath and falls over the
   out-breath, as breathwork apps often use. It never competes with the narrator.

## Decisions to make

- Breath or tone, from the samples. The operator listens; nothing ships on a description.
- Always on, or a choice on the audio card beside the voice and bed ("Breath cues: on /
  off"). Leaning toward a choice, off by default, until it is known people like it.
- Where the model uses it: only directly after a breathing instruction, never as decoration,
  and never stacked with a `SOUND` marker at the same point.

## Scope sketch

1. **Samples first:** render a few lengths of each candidate (a scratch script, not the
   snapshot) and mix one into a real finished meditation so it is heard in context. Stop
   here if neither sounds right.
2. Add the files to `scripts/sound-effects.ts` and `src/lib/meditation/sounds.ts` (the test
   keeps them in step), the `BREATH` marker to the parser and the timeline, and its
   duration to the estimate.
3. Prompt: the marker, when to use it, and the allowed lengths. Check with
   `scripts/measure-studio-rewrites.ts` that scripts stay on length.
4. If it is a choice: the audio card row and the meditation page panel share it
   (`src/components/audio-choices.tsx`), saved in `settings`.
5. Rebuild the snapshot and redeploy `AUDIO_SANDBOX_SNAPSHOT_ID` (`audio-pipeline` skill);
   without that, nothing changes in production.

## Not in scope

Spoken counting ("in, two, three, four"), which the narrator already does when the script
says so, and visual breathing guides in the session player (a separate idea).
