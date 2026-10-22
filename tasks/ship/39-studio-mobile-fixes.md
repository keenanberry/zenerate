# Studio Mobile Fixes

**Status:** In review (PR open). The real-iPhone keyboard check is the operator's.
**Priority:** Phase 6. The studio is the product, and the operator found both on a phone.
**Phase:** 6 (seed & open)
**Depends on:** 30 (studio UI), 31 (audio from chat), 24 (install)

## Why

The operator used the studio on an iPhone (production, Safari and the installed PWA) and hit
two bugs:

1. Once a render's player appeared in the chat, the whole chat scrolled sideways.
2. The composer sat low, below the content, so they could not type while seeing the
   conversation, least of all with the keyboard open.

## Root causes

**1. Sideways scroll.** The player's halo (`player-halo` in `audio-player.tsx`) is an
absolutely positioned glow that spills past its card by design: 8px in light, 16px in dark,
and 16px and 56px from `sm` up. On a meditation page that spill sits in the shell's gutter.
In the studio the player is inside the chat's message list, which is `overflow-y-auto`. When
one axis is not `visible`, CSS computes the other axis as `auto` too, so the halo's spill
became horizontal scroll. Measured at 375px in dark: the list was `scrollWidth` 359 inside a
`clientWidth` of 343, and the halo (left 0, right 375) was the only element outside it. The
waveform, the controls row and the card text were all inside.

A second overflow was hiding behind the first. Below `md` the studio grid had no column
template, so its single implicit `auto` column took the min-content width of the longest
unbroken token in the chat (706px at 390 for a long URL), and the chat column grew with it.

**2. The composer drops below the content.** The studio sized itself as
`h-[calc(100dvh-9rem)]`, an estimate of what the nav and the shell's padding leave. But it
sat in the ordinary page flow, with the shell's bottom padding and the site footer below it,
so the document was 134px taller than a 375×667 viewport. The page itself scrolled, and the
composer scrolled with it (from 628px to 494px when the page reached its end). On iOS this
gets worse with the keyboard open. The keyboard covers the page without changing `100dvh` or
the layout viewport, and Safari scrolls the page to show the focused field. The studio keeps
its full height, the conversation goes off screen, and the footer comes into view.

## Fix

- **Chat list** (`chat.tsx`): it scrolls on one axis only (`overflow-x-hidden`). It bleeds
  16px into the gutter (`-mx-4 px-4`), so the halo and the focus rings have room before the
  clip. In the chat, the halo spills no further sideways than those 16px, so the clip leaves
  no edge on desktop dark. Message text gets `wrap-break-word`.
- **Studio grid** (`studio.tsx`): `grid-cols-[minmax(0,1fr)]` below `md`, so content can
  never widen the column. The two-pane templates from `md` up are unchanged.
- **Shell** (`(app)/layout.tsx`): on a page with `[data-studio]`, the shell is pinned to
  the visible viewport (`fixed`, at `--viewport-top`, `--viewport-height` tall), `main` is a
  flex column, and the footer is hidden. The studio fills `main` with `flex-1` in place of
  the `calc()`, so the document never scrolls under it. Other pages are untouched. On
  `/dashboard`, `/discover`, `/meditation/[id]` and `/create` the shell stays `static` and
  the footer shows.
- **`useVisualViewport`** (`studio/use-visual-viewport.ts`): publishes
  `visualViewport.offsetTop` and `.height` as those two variables, and removes them on
  unmount. When the iOS keyboard opens, the shell shrinks to the area above it and follows
  Safari's pan, so the composer rides on the keyboard with the messages above it. The hook
  skips updates while pinch-zoomed. Without the variables (no JS yet, or no
  `visualViewport`) the shell falls back to `100dvh`.

`audio-player.tsx` and `audio-card.tsx` are unchanged (38b edits the card's logic).

## Acceptance criteria

- [x] At 375px and 390px, with a completed render's player in the chat,
  `document.documentElement.scrollWidth` equals `clientWidth` (375/375 and 390/390). The chat
  list's `scrollWidth` equals its `clientWidth`, and no element reaches past the viewport.
  Checked in dark and light.
- [x] The composer stays at the bottom with a long conversation, in both themes: its bottom
  edge is at 627px of 667 and 804px of 844 before and after a forced page scroll, and
  `scrollHeight` equals the viewport height. Screenshots are in `39-studio-mobile-fixes/`.
- [x] Simulated keyboard: shrinking the viewport to 370px with the composer focused keeps the
  nav at the top. The chat list shrinks to 163px and the composer sits just above the cut.
- [x] The canvas sheet still opens at 88% with no horizontal overflow. The "Script updated"
  pill stays in flow above the composer (unchanged markup).
- [x] Desktop two-pane layout unchanged: at 1280×800 the grid spans 121px to 744px, as the
  old `calc(100dvh-11rem)` did.
- [ ] Real iPhone keyboard check (operator, after deploy; see Outcome).
- [x] Lint (0 errors), `tsc --noEmit`, `npm test` (376 passed) and `npm run build` pass.

## Outcome

Both bugs reproduced in Chrome at 375 and 390px (same-origin iframes sized to the phone,
because a Chrome window stops near 500px) before any change, and both are fixed at the
cause. The numbers are in the acceptance list above. The impeccable detector reports nothing
on the changed files.

Decisions:

- I clipped the chat list rather than shrinking the halo in `audio-player.tsx`. The halo is
  meant to spill on the meditation page, and only the chat puts it in a scroll container.
- I hid the footer and pinned the shell on the studio route with a `:has([data-studio])`
  variant, not a client-side pathname check, so the server-rendered first paint is already
  right. `:has()` needs Safari 15.4 or later.
- I followed the visual viewport rather than adding `interactive-widget=resizes-content` to
  the viewport meta. iOS ignores that key, and the hook covers Android too.

**For the operator (iPhone, after deploy):** open a chat with a finished render, in Safari and
in the installed PWA.

1. Swipe left and right across the player and the messages. Nothing moves sideways.
2. Tap the composer. The keyboard should push the composer up so it sits right on the
   keyboard. The nav stays at the top, the newest messages are visible above the composer,
   and there is no gap or footer between the composer and the keyboard.
3. With the keyboard open, scroll the messages. Only the list scrolls, not the page.
4. Dismiss the keyboard. The composer returns to the bottom with no blank band and no jump of
   the nav.
5. Tap "Script updated" (or a draft chip). The sheet opens over the chat, and closing it
   leaves the composer where it was.
