# Landing Hero Sits Too Low

**Status:** In review
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 45 (landing refresh)

## Why

The operator reported, with a screenshot of a desktop at about 1876x917, that since task 45
(#73) the hero headline "Meditations composed for you, not picked from a catalogue." starts
about 480px down. The CTAs sit at the very bottom of the first screen, beside a very tall demo
card that is mostly empty while it streams, with empty space above the headline.

## Root cause

Verified on `main` with Playwright at 1876x917, 1440x900 and 1280x800 (the hero is
`max-w-5xl`, so all three render alike):

- `src/components/script-stream-demo.tsx` reserved the height of every finished script by
  stacking all six invisibly in one grid cell, and did the same for the request bubbles and
  the closing lines, so the card was as tall as the longest of each: **863px**. #73 added the
  bubble and the closing line, which made it taller still.
- The hero grid in `src/app/page.tsx` used `lg:items-center`, so the copy column centred
  against that card: the headline's top was at **426px** and the CTAs at **815–855px**, below
  the fold at 1280x800.

At 390px the card was 881px tall.

## Decision

- **The script sits in a fixed window: `h-52` (13rem), one height at every width.** It is
  sized so that at 1280x800 the whole figure, chips and caption included, ends above the fold
  (792px). The six full-script sizers are gone. The request and reply sizers stay: they are
  short, and they are what keep the card one height across examples.
- **The window follows the newest line** with the studio canvas's `useFollowScroll`. It starts
  with following off, and a new script calls `scrollToEnd()` when its first words arrive, so
  under reduced motion the window stays on the opening lines. A visitor who scrolls up inside
  it lets go, as in the studio. The window scrolls; the page never does. Its scrollbar is
  hidden (`scrollbar-width: none`), and it stays `aria-hidden` as the old script area was.
- **The top edge fades out through a `mask-image` alpha ramp** (`transparent` to `black` over
  2rem), with 2rem of top padding so a script's first line starts below the fade. This sets
  only alpha and adds no hue, so it is not a One Gradient Rule exception. DESIGN.md now says
  so under that rule, and its Landing Demo section describes the window.
- **Under reduced motion** the window shows the start of the chosen script with the fade
  turned to the bottom edge, where the script continues, plus "Ready" and the reply. The
  brief said "with the fade"; a top fade would hide the opening sound marker, so the fade
  moves to the edge where the text is cut off.
- **Hero alignment:** `lg:items-start`, and the top padding at `lg` drops from `py-20` to
  `py-14`, so the headline and the card's top edge share a line just under the nav.
- Kept from #73: the chips, the request bubble, Draft 1 with Writing/Ready, the closing line,
  the caption, and no "focus" wording.

## Acceptance

- [x] At 1440x900 and 1280x800 the headline's top is within the top third of the screen and
      the CTAs are visible without scrolling. Measured: h1 at 121–342px, CTAs at 510–550px,
      card 121–620px, figure 121–792px (the same at 1876x917, in dark and light).
- [x] No layout shift as the examples cycle. The card measured 499px at desktop and 483px at
      390px through 20s of streaming, the hold and the next example, and taps on three chips.
      Lighthouse CLS is 0; in-page `layout-shift` entries sum to under 0.0002.
- [x] Lighthouse mobile is no worse than main: the branch scored 90, 92 and 92 and main 91, 91
      and 91, on the same machine against `next start`. Accessibility is 100.
- [x] No horizontal overflow at 390px: `scrollWidth` 390.
- [x] Lint (0 errors; the 5 warnings are in untouched files), `tsc --noEmit`, tests (426) and
      build pass.

## Outcome

`script-stream-demo.tsx` now shows the script through a 13rem window that follows the newest
line and fades it out under the top edge. `page.tsx` aligns the hero to the top. DESIGN.md
records the mask and the window. The card went from 863px to 499px on desktop and from 881px
to 483px at 390px. The headline moved from 426px to 121px, and the CTAs from 815px to 510px.

Evidence is in `46-landing-hero-height/`: `before-dark-*` from `main`; `after-*` in dark,
light and reduced motion at 1876x917, 1440x900, 1280x800 and 390x844; and
`after-dark-390x844-card.jpg`, the stacked card at phone width.

For the operator: check the hero on the 1876x917 desktop from the report, and on a real phone
that scrolling inside the demo card hands off to the page cleanly at either end.
