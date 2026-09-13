# Lock-Screen Audio (Media Session)

**Status:** Not started
**Priority:** Ship-blocker — arguably the highest-value item in Phase 3
**Depends on:** 24 (most valuable in the installed PWA, though it works in-browser too)

## Why this blocks ship

A meditation user closes their eyes. The phone screen locks. If playback stops there, the
product does not work for its primary use case — and this is easy to miss in testing,
because nobody tests with the screen off.

Without Media Session metadata the lock screen also shows nothing useful: no title, no
artwork, no controls. The user has to unlock, find the tab, and scrub.

This matters more than installability, and it lives in the same neighbourhood of work.

## Acceptance criteria

- [ ] Resolve the media-element question. **Measured 2026-09-13 in real Chrome:** `document.getElementsByTagName('audio').length` is **0** on a playing meditation page, and `src/components/audio-player.tsx` calls `WaveSurfer.create({ url: audioUrl })` with no `media` or `backend` option. Whatever element v7 creates internally is not in the document. Determine whether that element can carry a Media Session and survive an iOS screen lock, and if not, pass an explicit `media: new Audio(url)` so there is an element you control. Do not assume adding metadata is sufficient — this task may be a wavesurfer reconfiguration first and a metadata task second
- [ ] `navigator.mediaSession.metadata` populated with the meditation title, a sensible artist/album line, and artwork from the icon set (task 23)
- [ ] Action handlers wired: `play`, `pause`, `seekbackward`, `seekforward`. Also `seekto` if the seekbar is wanted
- [ ] `previoustrack` / `nexttrack` deliberately left unset — there is no queue, and setting them puts dead buttons on the lock screen
- [ ] `navigator.mediaSession.playbackState` kept in sync with actual playback
- [ ] Feature-detected — `mediaSession` is absent on some browsers and must not throw
- [ ] **Verified on a real iPhone**: start a meditation, lock the screen, confirm audio continues, confirm title and artwork appear on the lock screen, confirm the lock-screen play/pause controls work
- [ ] Same verified in the installed PWA from task 24, not only in Safari
- [ ] Verified audio survives switching to another app

## Implementation notes

- Everything lives in `src/components/audio-player.tsx`, alongside the existing wavesurfer setup.
- Artwork wants multiple sizes in the `artwork` array; iOS picks what it needs. The 512px icon from task 23 is enough to start.
- iOS will not begin playback without a user gesture. That's fine — playback always starts from a tap here — but it means this can't be tested by autoplaying.
- Long silences are the risk worth checking. A meditation with a `*[SILENCE: 10 minutes]*` block is a continuous audio stream with quiet passages, not a gap in playback, so it should be fine — but verify with a real long meditation rather than assuming.
- Clean up handlers on unmount, or navigating between meditations leaves stale handlers bound to a disposed player.

## Open questions

- Should seek offsets be the default 10s, or longer for meditation content where 30s might be more useful? Minor; pick 15s and move on unless it feels wrong in use.
