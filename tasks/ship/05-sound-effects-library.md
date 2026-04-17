# Sound Effects Library

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
`*[SOUND: filename.mp3]*` markers in generated scripts currently fall back to 1 second of silence because no sound files exist in the sandbox. Meditations that reference gongs, bells, or chimes end up silent at those moments — feels broken.

## Acceptance criteria
- [ ] Source licensed/royalty-free audio for at least: gong, Tibetan bell, singing bowl, chime, soft chime
- [ ] Files placed in a repo location (e.g. `scripts/sound-assets/`) so they're version-controlled
- [ ] `scripts/create-sandbox-snapshot.ts` updated to copy these files into `/sounds/` in the sandbox
- [ ] Snapshot rebuilt; `AUDIO_SANDBOX_SNAPSHOT_ID` updated in local and Vercel envs
- [ ] LLM prompt updated to reference only the sound filenames that actually exist (prevents hallucinated filenames)
- [ ] Manual test: generate a meditation that includes a sound marker, verify the effect plays in the output MP3
- [ ] Licensing note / attribution recorded somewhere (e.g. `scripts/sound-assets/README.md`) in case sources require it

## Implementation notes
- Good sources: Freesound.org (CC0 or CC-BY), BBC Sound Effects (non-commercial terms — check compatibility), Zapsplat (free with account, has attribution requirement on free tier).
- Keep individual files small (<500 KB) — they bake into the snapshot and multiply across every sandbox instance.
- Consider normalizing volume across all sound files so they don't blow out the mix relative to voice.
- The LLM needs to know the exact filenames available. Either inject them into the prompt dynamically or list them explicitly in the system prompt.

## Open questions
- Does the fade-in/fade-out need to be part of the source file, or applied in FFmpeg during concatenation? (Better as FFmpeg — more reusable.)
