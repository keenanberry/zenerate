# Sound Effects Library

**Status:** Done*
**Priority:** Ship-blocker

## Why this blocks ship
`*[SOUND: filename.mp3]*` markers in generated scripts currently fall back to 1 second of silence because no sound files exist in the sandbox. Meditations that reference gongs, bells, or chimes end up silent at those moments — feels broken.

## Acceptance criteria
- [x] Source licensed/royalty-free audio for at least: gong, Tibetan bell, singing bowl, chime, soft chime
- [x] Files placed in a repo location (e.g. `scripts/sound-assets/`) so they're version-controlled
- [x] `scripts/create-sandbox-snapshot.ts` updated to copy these files into `/sounds/` in the sandbox
- [x] Snapshot rebuilt; `AUDIO_SANDBOX_SNAPSHOT_ID` updated in local and Vercel envs
- [x] LLM prompt updated to reference only the sound filenames that actually exist (prevents hallucinated filenames)
- [x] Manual test: generate a meditation that includes a sound marker, verify the effect plays in the output MP3
- [x] Licensing note / attribution recorded somewhere (e.g. `scripts/sound-assets/README.md`) in case sources require it

## Outcome (2026-10-09)

**Snapshot `snap_MXu6Sl0RX5di37AmE6j8vM7Nhz8y`.** \*Live once `AUDIO_SANDBOX_SNAPSHOT_ID`
is set in Vercel and production redeployed. The acceptance criteria above are met with
two deliberate deviations: no audio files in the repo, and the manual test was run
through `scripts/test-audio-generation.ts`, not a production meditation.

- **Four synthesized, two recorded.** Bells, chime and bowl are rendered at build time
  from FFmpeg recipes in `scripts/sound-effects.ts`: inharmonic partials with
  exponential decay. Synthesis couldn't make a convincing gong, so the gongs are CC0
  Freesound recordings (cabled_mess #369428, psuess #194432), trimmed and
  normalized once. They're kept in the private production `sound-effects` bucket, not
  the repo; the build downloads them and verifies SHA-256. Source, license and
  processing are in the manifest.
- **Narration is now normalized to -20 LUFS** (`src/lib/audio/loudness.ts`). ElevenLabs
  returns each voice at its own level: Vincent -27.3, Brittney -33.6, Sarah -16.7.
  Without normalization no single effect level could be right, and quiet voices made
  whole meditations quiet.
- **Levels were set by ear**, against the gongs, then in a mock mix with normalized
  narration. LUFS matching was ~15 dB off for the pure-tone synths versus the
  bass-heavy gongs. The reasoning is in the `SYNTH_GAIN_DB` comment.
- **The prompt and the duration estimate read one catalog**,
  `src/lib/meditation/sounds.ts`. The prompt shows each sound's length, and the
  estimate counts it. A test fails if the prompt, catalog and build drift apart.

**Found along the way, not fixed here:** the voice picker only lists six hard-coded
built-in voices and misses the operator's collection. The default voice
`Mu5jxyqZOLIGltFpfalg` is commented "Jameson" but is actually "Tim - Solid and
Enthusiastic", not a meditation voice.

## Implementation notes
- Good sources: Freesound.org (CC0 or CC-BY), BBC Sound Effects (non-commercial terms — check compatibility), Zapsplat (free with account, has attribution requirement on free tier).
- Keep individual files small (<500 KB) — they bake into the snapshot and multiply across every sandbox instance.
- Consider normalizing volume across all sound files so they don't blow out the mix relative to voice.
- The LLM needs to know the exact filenames available. Either inject them into the prompt dynamically or list them explicitly in the system prompt.

## Open questions
- Does the fade-in/fade-out need to be part of the source file, or applied in FFmpeg during concatenation? (Better as FFmpeg — more reusable.)
