# Designed Cover System

**Status:** In review
**Priority:** Phase 5, Wave B
**Phase:** 5 (Discover)
**Depends on:** 28 (tags)
**Blocks:** 36 (36 can start with a placeholder slot)
**Skill:** `zenerate-design`. **Required**, because this amends `DESIGN.md`.
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

Spotify's lists feel alive because every row has art. Generated artwork is deferred
(`tasks/post-ship/generated-cover-art.md`). Until then, every meditation gets a designed
cover, derived from its data, that is free, deterministic and always on brand.

## Scope

- **`MeditationCover`** (`src/components/meditation-cover.tsx`):
  - Its props are `{ id, tags, title, size }`.
  - It is deterministic: the same meditation gives the same cover on every render and
    every device.
  - It is derived from the first tag's group and a hash of the id.
  - It is square and works from 48 px (track rows) to 320 px (meditation page header).
- **The design constraint:** `DESIGN.md`'s One Gradient Rule reserves gradients for the
  player. Either amend `DESIGN.md` with a bounded exception for covers, recording why, or
  use a non-gradient treatment (tone fields, the lotus mark, texture). The skill's
  process decides which, and the decision goes into `DESIGN.md` either way.
- **Placement:** the Discover cards and rows (with 36), `meditation-card.tsx`,
  `track-row.tsx`, the meditation page header, and the Media Session artwork (task 25
  uses the mark today; a per-meditation cover is better if it rasterizes cheaply.
  Otherwise leave it and note why).

## Acceptance criteria

- [x] A determinism test: the same input gives the same output markup.
- [x] Dark and light: covers sit inside the Nocturne grounds without glowing or muddying.
- [x] `DESIGN.md` records the cover rule.
- [x] Screenshots of 24 sample covers in a grid in the PR, so the set's variety is
  visible.

## Outcome

**What shipped.** `MeditationCover` (`src/components/meditation-cover.tsx`) takes
`{ id, tags, title, size }` and draws an inline SVG on a 100-unit box. The first tag's
group picks two hues (themes Amethyst and Periwinkle, practices Sage and Periwinkle,
moments Candle and Amethyst; untagged or unknown tags draw in Dusk). An FNV-1a hash of
the id picks one of five motifs (moon, ripples, strata, lotus, orbit) and seeds the
composition. It is mounted at 48px in `track-row.tsx` (with a matching spacer in the
`meditation-track-list.tsx` header row), at 64px above the title in
`meditation-card.tsx`, and at 160px in the meditation page header. Each mount is a few
lines, and none of the existing markup was restructured. Task 36 imports it for Discover.

**Design decision: non-gradient.** I followed the `zenerate-design` process and kept the
One Gradient Rule whole. Covers are flat tone fields: shapes in `currentColor` at 12 to
70% opacity over a new `--cover-ground` token (Deep Night in dark, a step below Paper in
light). Layered opacities give the depth a gradient would, nothing glows, and the
player's rose gradient stays the only lit thing in the room. `DESIGN.md` records the new
Covers section, both token values, a line under the One Gradient Rule, and a Do and a
Don't.

**Media Session artwork: left as the brand icon.** The OS needs a raster URL. A
per-meditation cover would mean resolving the CSS tokens and rasterizing on the client,
or adding a server image route with its own data read, and only a phone lock screen can
verify the result. That does not count as cheap, so `DESIGN.md` records the reason.

**Evidence.**
- `src/components/meditation-cover.test.tsx` covers four things: the same input gives
  identical markup at 48, 160 and 320px; the hash is pinned to known FNV-1a values; 24
  ids give 24 distinct covers across at least four motifs; and the markup holds no
  colour values and no gradient.
- One bug turned up in the browser: a hydration mismatch. The motif components shared a
  stateful random sequence, and React's double render in Strict Mode consumed it twice.
  Each motif now seeds its own sequence, and the dev overlay is clean.
- Verified in this order: dark at desktop width, dark at 390px, then light at both widths,
  on the library list, the library grid and the meditation page. The 390px checks used
  390px iframes, because DevTools emulation cannot be driven from here.
- `impeccable detect` reports nothing.
- The 24-cover grid is at `docs/screenshots/35-cover-grid.png`.

**For the operator.**
- Check one cover on a real phone, in the library and on a meditation page.
- Production data needs nothing. Covers derive from existing `id` and `tags` columns, and
  rows with no tags get the quiet Dusk cover.

