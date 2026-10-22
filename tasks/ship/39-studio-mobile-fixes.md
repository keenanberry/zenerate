# Studio Mobile Fixes

**Status:** Done (PR #66). The real-iPhone keyboard check is the operator's.
**Priority:** Phase 6. The studio is the product, and the operator found both on a phone.
**Phase:** 6 (seed & open)
**Depends on:** 30 (studio UI), 31 (audio from chat), 24 (install)

## Why

The operator used the studio on an iPhone (production, Safari and the installed PWA) and hit
two bugs:

1. Once a render's player appeared in the chat, the whole chat scrolled sideways.
2. The composer sat low, below the content, so they could not type while seeing the
   conversation, least of all with the keyboard open.

The coordinator added two more layout bugs to this task during the run:

3. On desktop, the voice picker in the studio's audio card crushed its cards. The name,
   play button and gender badge overlapped, the badge spilled past the card, and the
   descriptions cut to 3–4 letters.
4. On the meditation page at desktop width, the header crushed the details column to about
   120px. The title wrapped one word per line and each tag sat on its own line.

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

**3. Voice picker.** The grid was `sm:grid-cols-2`, a *viewport* breakpoint. Any window 640px
or wider got two columns, including the chat column, which is 20–24rem on any screen. That
left each card about 150px for a 36px icon, the name, the badge, the description and a 32px
play button. The name row did not wrap, so the badge overlapped the button and ran past the
card's edge. It is the same kind of cause as bug 1: layout keyed to something other than
the container the content sits in.

**4. Meditation page header.** The cover, the details and the actions were three items in one
flex row. The details column was `flex-1` (a 0% basis), and the actions group kept
`flex: 0 1 auto` with its max-content width (four buttons in a line) as the basis. Inside the
768px column the actions took their full width first, and the details got what was left: an
h1 72px wide at both 1440 and 1024.

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

- **Voice picker** (`voice-picker.tsx`): the picker is an `@container`, and the grid goes
  two-up at `@xl` (its own width ≥ 36rem). That is one column in the chat at every screen
  size, and two in the meditation page's Generate Audio panel. The name row is
  `flex-wrap`, so the badge drops under a long name instead of colliding with it.
- **Meditation header** (`meditation/[id]/page.tsx`): two columns, the cover and the
  details, with the actions as their own wrapping row under the status line. The row is
  `empty:hidden`, so signed out (no actions at all) leaves no gap.

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
- [x] Voice picker: one column in the chat at 1280 (318px cards), 375 and 390; two columns
  (345px cards) in the meditation page panel. In every card the name ends before the play
  button, no descendant reaches past the card, and the description reads in full
  ("Relaxing, Calm and Meditative"). Checked in dark and light; before and after
  screenshots are in `39-studio-mobile-fixes/`.
- [x] Meditation header: the title is on one line (254px) at 1440, 1024 and 390, in dark and
  light. Checked the owner (Continue in chat, Private, favourite, Add to collection), a
  signed-in non-owner (favourite and Add to collection only), signed out (no actions row;
  checked in a `credentialless` iframe so the shared login was never touched), and the
  editing state (the 588px title field at desktop, 358px at 390). No horizontal overflow
  anywhere.
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
6. On a chat still offering audio, the voice list is one card per row with names, badges and
   descriptions readable.
7. On a meditation page, the title, description and tags read at full width, with the
   buttons in a row underneath.

Local test data, left in the shared DB (private, owned by alice): meditations
`39390000-…-000000000039` (completed, retitled "Steady Before the Stage") and `…040`
(script_ready), with chats `…00c1` and `…00c2`. Delete them whenever you like.
