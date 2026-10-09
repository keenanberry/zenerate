# Lock-Screen Audio (Media Session)

**Status:** Done* — *every device check (the Mac Now Playing checks as well as the iPhone ones) is the operator's after merge: this Mac's session was password-locked for the whole run, so no page could become visible
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

- [x] Resolve the media-element question. **Measured 2026-09-13 in real Chrome:** `document.getElementsByTagName('audio').length` is **0** on a playing meditation page, and `src/components/audio-player.tsx` calls `WaveSurfer.create({ url: audioUrl })` with no `media` or `backend` option. Whatever element v7 creates internally is not in the document. Determine whether that element can carry a Media Session and survive an iOS screen lock, and if not, pass an explicit `media: new Audio(url)` so there is an element you control. Do not assume adding metadata is sufficient — this task may be a wavesurfer reconfiguration first and a metadata task second
- [x] `navigator.mediaSession.metadata` populated with the meditation title, a sensible artist/album line, and artwork from the icon set (task 23)
- [x] Action handlers wired: `play`, `pause`, `seekbackward`, `seekforward`. Also `seekto` if the seekbar is wanted
- [x] `previoustrack` / `nexttrack` deliberately left unset — there is no queue, and setting them puts dead buttons on the lock screen
- [x] `navigator.mediaSession.playbackState` kept in sync with actual playback
- [x] Feature-detected — `mediaSession` is absent on some browsers and must not throw
- [ ] **Verified on a real iPhone**: start a meditation, lock the screen, confirm audio continues, confirm title and artwork appear on the lock screen, confirm the lock-screen play/pause controls work (operator, after merge)
- [ ] Same verified in the installed PWA from task 24, not only in Safari (operator, after merge)
- [ ] Verified audio survives switching to another app (operator, after merge)

## Implementation notes

- Everything lives in `src/components/audio-player.tsx`, alongside the existing wavesurfer setup.
- Artwork wants multiple sizes in the `artwork` array; iOS picks what it needs. The 512px icon from task 23 is enough to start.
- iOS will not begin playback without a user gesture. That's fine — playback always starts from a tap here — but it means this can't be tested by autoplaying.
- Long silences are the risk worth checking. A meditation with a `*[SILENCE: 10 minutes]*` block is a continuous audio stream with quiet passages, not a gap in playback, so it should be fine — but verify with a real long meditation rather than assuming.
- Clean up handlers on unmount, or navigating between meditations leaves stale handlers bound to a disposed player.

## Open questions

- Should seek offsets be the default 10s, or longer for meditation content where 30s might be more useful? Minor; pick 15s and move on unless it feels wrong in use.

## Outcome (2026-10-09)

### What shipped

- `src/components/use-media-session.ts`: `bindMediaSession` (framework-free), `useMediaSession`
  (the effect wrapper) and `watchMediaElement` (reports which `<audio>` wavesurfer plays through).
  Metadata is the meditation title, artist "Zenerate" and artwork `/icon-192.png` and
  `/icon-512.png`. Handlers: `play`, `pause`, `seekbackward` and `seekforward` (15 s, or the
  offset the OS asks for), and `seekto` (uses `fastSeek` when the OS asks for it). `playbackState`
  and `setPositionState` follow the element's own `play`/`pause`/`ended`/`seeked`/`ratechange`/
  `durationchange` events. `previoustrack`/`nexttrack` are never set.
- `src/components/audio-player.tsx` takes a `title` prop and calls the hook. It has no markup
  or className changes, so task 21 can restyle without touching any of this.
  `src/components/audio-section.tsx` passes `meditation.title`. The page already hands
  `AudioSection` the whole meditation, so `page.tsx` is unchanged.
- 26 unit tests: `use-media-session.test.ts` covers the pure functions and the binding, and
  `use-media-session.hook.test.ts` covers the hook lifecycle against a stubbed
  `navigator.mediaSession`, a fake wavesurfer and a minimal `useEffect` runner.

### Decisions

- **No `media: new Audio(url)`. Wavesurfer's own element is used.** In v7, with no `media`
  option, `Player` calls `document.createElement('audio')`, which is the same object `new Audio()`
  returns, and `Renderer` appends it to the waveform's *open shadow root*. Measured on the local
  page: one shadow host holds an `<audio>` with `isConnected === true`, playing a `blob:` URL of the
  whole fetched file. `document.getElementsByTagName('audio')` does not cross shadow roots, which
  is why the 2026-09-13 measurement read 0. The Media Session is per document and attaches to
  whichever media element plays, so this element qualifies. Passing our own `new Audio()` would
  give an element that is *detached* from the document. It would also make us responsible for the
  teardown wavesurfer's `destroy()` already does (pause, revoke the blob URL, `load()`), since
  wavesurfer leaves external media alone. If the iPhone check fails anyway, try passing
  `media: document.createElement('audio')` to `WaveSurfer.create` in `audio-player.tsx`; the
  hook binds to whatever `ws.getMediaElement()` returns, so nothing else changes.
- **Handlers drive the element, not wavesurfer.** Wavesurfer already follows the element's
  events, so the waveform and the play button stay in step with an OS-initiated play, pause or seek.
- **15 s skips**, per the open question.
- **Artist "Zenerate", no album.** iOS and macOS show title plus one subtitle line.

### Evidence

- `npm run lint`: 0 errors. The 4 warnings are pre-existing, in files this branch does not touch.
  `npx tsc --noEmit`, `npm test` (163 tests) and `npm run build` all pass.
- Mutation check: dropping the hook's cleanup `return` fails 3 of the hook tests.
- Visual: the diff contains no JSX or className changes. Dark and light at desktop width match
  the pre-change screenshot. 390 px could not be rendered: the screen was locked, so window
  resizing had no effect (`innerWidth` stayed 1920). The impeccable detector found nothing.

### Found along the way

- **A volume change rebuilt the whole player.** `initWaveSurfer` listed `volume` as a
  dependency, so moving the slider destroyed and recreated wavesurfer, restarting playback from 0.
  It would also have dropped the Media Session binding. The volume to apply on load now lives in
  a ref. This was read from the code, not reproduced in a browser (see the locked screen below).
- **The on-Mac checks could not run.** The session was password-locked, so Chrome reported
  every page as `visibilityState: "hidden"`. Chrome does not load media for a page that has never
  been visible: `play()` stayed pending at `readyState` 0. This cannot happen in normal use,
  because playback always starts from a tap on a visible page.
- **Parallel workers share one sign-in on `localhost`.** Cookies are not port-scoped, so a
  worker on another port signing in replaces your Supabase session. `127.0.0.1` and
  `*.localhost` don't help: Next's dev server serves its JS only to `localhost`, so those pages
  never hydrate. For this run the test meditation was made public, so it rendered under any session.
