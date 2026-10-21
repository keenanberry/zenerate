# Audio From the Chat

**Status:** Not started
**Priority:** Phase 4, Wave A. Seeding needs it.
**Phase:** 4 (studio)
**Depends on:** 28, 29. Builds cards against 30's `renderStudioPart`, so it can run beside 30.
**Blocks:** 32, 37
**Skills:** `zenerate-design`, `audio-pipeline` (read it, though nothing here should
touch the snapshot)
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

Make the audio without leaving the conversation: pick a voice, press one button, watch
it render, hear it inline.

## Scope

- **`tool-offerAudio` card** (`src/components/studio/audio-card.tsx`):
  - The voice picker reuses `voice-picker.tsx` and `/api/voices`. It also shows the
    estimated length and how many renders remain (`getQuotaUsage`; "unlimited" for an
    exempt operator).
  - It has a **Make audio** button. **Only the click starts a render.** The click posts
    to `/api/audio/generate`, then answers the tool with
    `addToolOutput({ started: true, voiceId })`.
- **Progress card, then the player:** once a render has started, the same card shows
  progress. Reuse `audio-processing-status.tsx`'s polling of `getMeditationStatus`, then
  render the player inline (`audio-player.tsx` with the signed URL from the existing
  hydrator) and a link to the meditation page.
- **The trigger route renders the draft:** when `draft_script` is not null,
  `/api/audio/generate` accepts a meditation in `completed` status as well as
  `script_ready`, and the workflow renders `draft_script`. *Promotion* and archiving on
  completion belong to 32. Until 32 lands, a completed draft render simply overwrites the
  current version (the "replace" behavior), which is acceptable for Wave A.
- **Operator exemption** (`src/lib/audio/quota.ts`): a new env var
  `QUOTA_EXEMPT_USER_IDS` (comma-separated). An exempt user skips both the per-user and
  the global cap, and their events are excluded from the global count. Add it to
  `.env.example` with a comment.
- Check `npm view workflow dist-tags` (per `CLAUDE.md`) and note the result in the PR.

## Interfaces

- Consumes `tool-offerAudio` from 29 and `renderStudioPart` from 30.
- Produces `AudioCard` and `isQuotaExempt(userId: string): boolean`, both exported for 32.

## Acceptance criteria

- [ ] Quota tests:
  - An exempt user reserves past both caps.
  - A non-exempt user is still refused at 3.
  - An exempt user's events don't count toward the global total.
- [ ] Route test: a `completed` meditation with a `draft_script` is accepted; a
  `completed` one without a draft still gets 409.
- [ ] A double-clicked Make audio button creates exactly one reservation (the existing
  status guard returns 409 on the second click; the card disables the button on the
  first).
- [ ] End to end locally: chat, script, voice, Make audio, progress, then the inline
  player plays the new audio.
- [ ] The agent never starts a render on its own. Reading the code, confirm that the
  only caller of `/api/audio/generate` is the card's click handler and the meditation
  page's retry.
- [ ] `docs/architecture.md` names the chat as the trigger.
