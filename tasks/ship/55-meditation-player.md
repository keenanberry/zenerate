# Meditation Detail Page and Session Player

**Status:** Not started. Mockup up for the operator's review
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 49 (album covers), 54 (page meta)

## Why

The operator, 2026-10-23: on a phone, the only play control in a list is tapping the
cover, and "I don't think folks will read the script honestly." Their reference is
Insight Timer, in the same category: open a meditation, land on its page, press one big
Play, and the screen becomes the session. Spotify's tap-to-play plus mini-player was
considered and dropped: a meditation is chosen and committed to, not shuffled, and a
mini-player is days of plumbing that the category does not use.

Mockup: https://claude.ai/artifact/S8Tu8CjAJkephvSx9oVpCR

## Decisions (proposed; confirm against the mockup)

**Detail page** (`src/app/(app)/meditation/[id]/page.tsx`)
- Full-width cover on a phone (the 160px header stays from `sm`), then the meta line
  ("Sleep · 20 min"), then the title with the heart and a "…" menu beside it.
- One primary full-width **Play** button under the title. Solid Primary, not the
  gradient (DESIGN.md: no gradient on a CTA).
- Continue in chat, Public/Private, Add to collection and Download move into "…".
- The description, then the script collapsed behind "Show script".

**Session player**
- Play opens a full-screen view on a phone and a large centred one from `sm`. It is an
  overlay on the same page, never a new route, so wavesurfer's `<audio>`, the Media
  Session (task 25), downloads and the script sync stay on one element.
- The meditation's cover fills the background (`crop`), fading to night at the bottom
  through an alpha mask.
- The gradient play/pause at about 84px, with 15-second skips either side.
- Remaining time as the large number, in Lora with tabular figures; a slim waveform as
  the progress bar (it shows the silences); elapsed and remaining under it.
- Title and meta under the bar; a down-chevron minimizes back to the page while the
  audio plays on; "…" holds download, favourite and "Show script".
- Always dark: a lights-down mode for eyes closed, in either theme.

**Lists**
- On a phone the whole row opens the page, as in Insight Timer; tapping the cover no
  longer plays. From `sm`, the hover-to-play index column stays.

**Product record**
- `PRODUCT.md` principle 4 changes: the script is read in the studio, where it is
  reviewed before a render; once a meditation exists it is listened to, not read.

## Not in scope

- A persistent mini-player and tap-to-play rows (Spotify's model). Dropped, see Why.
- Insight Timer's "Finish" (a completed-session log for stats). A post-launch idea.
- Custom artwork, see `tasks/post-ship/generated-cover-art.md`.

## Acceptance

- [ ] Detail page and session player in dark and light (player dark in both), at 390px
      and desktop.
- [ ] Play, pause, both skips and scrubbing work in the session view; closing it keeps
      the audio playing; reopening shows the right position.
- [ ] The Media Session still shows title, artwork and controls (task 25).
- [ ] The script, when shown, still follows playback.
- [ ] A meditation without audio shows the existing generate or processing states, not Play.
- [ ] Operator: the iPhone lock screen while the session view is open, in Safari and the
      installed app.
