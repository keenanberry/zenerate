# Meditation Page Meta and Collection Artwork

**Status:** In progress
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 48 (quiet list), 49 (album covers)

## Why

The operator, after 49 shipped (2026-10-23): the collection cards "seem a bit childish",
the meditation page's tag chips are not liked, and the "completed" badge on the page and
on every grid card "doesn't make much sense anymore since we changed things to a chat".
Their direction for status: "just use an icon for those that aren't [completed]. It'll
be exception to not have audio and just a script."

## Decisions (approved by the operator 2026-10-23)

- **Collections are playlists.** Artwork from the first covers: two side by side, three as
  a half and two quarters, a 2x2 mosaic from four (the operator expected a two-meditation
  collection to show both), one cover whole, a quiet cover when empty, the name in Lora, a Dusk line
  of count and description. The collection page header carries the artwork too.
- **No status badges.** Completed shows nothing. Script only, being made and failed each
  get a 14px icon before the meta line, in the grid card and the track row.
- **The meditation page's tags are a Dusk line of links into Discover**, followed by the
  length and date. The status badge and the clock-and-date row are gone; the audio
  section already shows the state. Pills stay in the edit form.
- `getUserCollections` fetches the covers in the same query as the collections, which
  also replaces its one-count-query-per-collection loop.

## Acceptance

- [x] Collections tab, a collection page and a meditation page in dark at 390px and
      1280px, and light at 1280px; the grid view and the list in dark at 1280px and 390px.
- [x] No "completed" anywhere; a script-only meditation shows the file icon with an
      accessible name.
- [x] A wrapped meta line never starts with a `·`.
- [ ] Operator: the collections tab and a meditation page on the iPhone.
