# Quiet List: Rows Without Chips

**Status:** In progress. Code done and verified locally; PR not opened yet
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 33 (tag display), 35 (covers)

## Why

The operator, on the Library list view on an iPhone (2026-10-23): "it feels not very mature and
almost too childish... doesn't give me the feeling of a spotify or apple music list." A
two-reviewer Impeccable critique (snapshot in `.impeccable/critique/`, mockups at
https://claude.ai/artifact/PrasUYaaYSp1M3GfbvUFQt) traced it to the rows, not the palette:

- Two to four filled, letter-spaced tag pills per row (`tag-pills.tsx`) at the title's
  lightness. A row reads as five objects instead of one.
- A `# / TITLE` table header and a column of play triangles on a phone
  (`meditation-track-list.tsx`, `track-play-button.tsx`).
- A 14px title, the weakest text in the row.
- Long titles clip mid-word: `truncate` sits on a `display: flex` span (`track-row.tsx`),
  where `text-overflow: ellipsis` does nothing.
- Icon-only controls with no accessible name: the view toggle, the favorite and play
  buttons, and the Library tabs below `sm`.

This is direction **A** of the approved plan. Task 49 (album covers) is direction B on top.

## Decisions (approved by the operator 2026-10-23)

- **A row is a cover, a title and one quiet line.** Title in Body type (16px, 500,
  Foreground), one line, ending in "…". Under it a Dusk (`text-muted-foreground`) meta line:
  first tag · duration · date, e.g. `Grounding · 10 min · Yesterday`. No pills in rows.
- **Inset dividers.** A Hairline rule between rows that starts where the text starts, so the
  covers keep a clean column (the Apple Music pattern). Chosen over none and over
  full-width in the mockup.
- **Phones: no header, no play column.** The cover is the play target, with a round play or
  pause button over it while playing, in Amethyst Glow (not the gradient, which stays on the
  player). From `sm` up, the hover-to-play index column stays.
- **No header row at any width.** With Type, Duration and Date folded into the meta line,
  the header labelled a single column; Apple Music's song lists have none.
- **The Type column goes.** It duplicated a tag in most rows and was empty in the rest.
- **Shelf and grid cards drop their pills too**: cover, serif title, one meta line.
- **Tags stay where they are edited and filtered**: the meditation page and Discover's
  filters. Restyling those pills is out of scope here.
- **Library chrome speaks.** Tabs show their labels at every width. The New button says
  "New" on phones. The view toggle, favorite and play buttons get `aria-label`s.

## Acceptance

- [x] Library list, Favorites and a collection page show the new row in dark and light, at
      desktop width and at 390px.
- [x] A long title ends in "…" at 390px.
- [x] On a phone, tapping a cover plays and pauses; tapping the text opens the page.
      (Playwright at 390px; the operator confirms on the iPhone.)
- [x] No tag pills in any track row, grid card or Discover shelf card.
- [x] Every icon-only control in the row and the Library chrome has an accessible name.
- [x] `DESIGN.md` records the row (Layout and Components) and drops the pills-in-rows rule.
- [x] `impeccable detect` is clean on the changed files (four advisory off-ramp font sizes fixed).
