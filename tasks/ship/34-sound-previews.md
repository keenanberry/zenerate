# Sound Previews in Chat

**Status:** Not started
**Priority:** Phase 5, Wave B
**Phase:** 5
**Depends on:** 29, 30
**Skills:** `audio-pipeline` (read the snapshot rules; this task must **not** change
`scripts/sound-effects.ts`'s output or anything in the sandbox), `zenerate-design`
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

"What does the singing bowl sound like?" should be answered with a play button, not a
description. The operator asked for this kind of card specifically.

## Scope

- **Browser-playable copies:** add a build step that writes browser-playable copies of
  the sound effects (the files `scripts/sound-effects.ts` produces for the snapshot) to
  `public/sounds/`. Commit them, or generate them at build time, whichever the
  `audio-pipeline` skill's loop makes cheaper to keep in sync.
- **Tool:** `previewSounds({ sounds: SoundName[] })`, executed on the server, which
  returns the names, labels and URLs. Add it to `studioTools` (29).
- **Card:** a row per sound with a play button and its length. One sound plays at a
  time. Rendered through `renderStudioPart`.
- **Prompt:** the agent offers previews when the user asks about sounds or seems unsure,
  and doesn't preview unprompted on every script.

## Acceptance criteria

- [ ] Every name in `SOUND_EFFECTS` has a file in `public/sounds/`, checked by a test.
- [ ] The snapshot ID is unchanged, and the PR states it.
- [ ] Asking "what sounds can you use?" produces the card, and each sound plays on a phone.
