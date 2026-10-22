# Cover Variety and setDetails Tag Leniency

**Status:** Done (PR #69), awaiting review
**Priority:** Phase 6. Discover is the first thing a new visitor sees.
**Phase:** 6 (seed & open)
**Depends on:** 35 (cover system), 41 (found the tag strings)
**Skill:** `zenerate-design`. **Required**, because this amends `DESIGN.md`.

## Why

**Covers.** The operator said the covers look too alike: they want more colour, and asked
"do we have to always have it be the circle?" `MeditationCover` had two variables: five
motifs, four of them round, and two hues from the first tag's **group**, of which there are
three. Most meditations lead with a theme tag, so most covers shared one palette. With 24
house meditations, Discover would show about five shapes in mostly one palette.

**Tags.** Task 41 found that about half of `setDetails` calls send `tags` as one
comma-separated string (`"breathwork,inner-peace"`). They fail validation and the agent
retries, a wasted step every time.

## Decisions

- **Colour per tag, not per group.** Each of the 28 tags gets its own pair of hues, and no two
  tags share a pair in either order. The hash still picks which of the pair leads.
- **Ten hues.** The four state hues (Amethyst, Periwinkle, Sage, Candle) plus six cover-only
  tokens, defined in both themes: rose, clay, moss, tide, mist, heather. Muted in dark,
  ink weight in light, like the state hues.
- **Fourteen motifs.** The five existing ones plus nine that are not round: dunes, waves,
  ridge, starfield, rain, leaves, stones, aurora (stepped columns), arch.
- **Meaning, loosely.** Two times in three, the motif comes from a short list that suits one
  of the meditation's tags, picked by the hash. It can be any tag, not only the first, so the
  picture does not simply follow the palette. Otherwise it comes from all fourteen.
- **Composition.** The hash also mirrors the picture and varies scale, position, layer count
  and density inside each motif.
- **Tag strings** are split on commas, trimmed and de-duplicated in a `z.preprocess` before the
  enum. The JSON schema the model sees is unchanged: still an array of the vocabulary.

## Acceptance criteria

- [x] Every tag has its own hue pairing, drawn from a palette wider than the four state hues,
  with new cover-only tokens in both themes in `globals.css` and in `DESIGN.md`'s Covers
  section.
- [x] At least five new motifs that are not round; round motifs are a minority.
- [x] Motifs lean toward meaning where it is natural, and fall back to the hash.
- [x] The hash varies composition within a motif, so the same motif and tag still differ.
- [x] Still deterministic, inline SVG, no gradients, flat tone fields; legible from 48 to 320px.
- [x] No hydration regression (#56): each motif seeds its own sequence, and the dev console is
  clean.
- [x] `MeditationCover` props unchanged.
- [x] A 48-cover grid in dark and light from realistic tag sets, in the PR.
- [x] `setDetails` accepts a comma-separated tag string, and still rejects values outside the
  vocabulary; a unit test proves both.
- [x] The determinism test passes; lint, tsc, tests and build pass.

## Outcome

### What changed

- **`src/components/meditation-cover.tsx`.** `TAG_HUES` maps each tag to a pair from ten hues,
  and `TAG_MOTIFS` maps tags to motifs that suit them. Nine new motif components join the five
  existing ones, which are unchanged. Every motif renders inside one `<g>` that the hash can
  mirror. `coverDesign` now returns `{ motif, tag, hues, mirrored, seed }`; the `group` field
  and `tagGroupOf` are gone, since nothing outside the file and its test used them.
- **`src/app/globals.css`.** Six `--cover-*` hue tokens in `:root` and `.dark`, exposed as
  `text-cover-*`.
- **`DESIGN.md`.** The new tokens are in the colour front matter, and the Covers section
  describes the ten hues, the fourteen motifs and how motifs lean on tags.
- **`src/lib/chat/tools.ts`.** Only `setDetailsInput.tags` changed: a `z.preprocess` splits
  a string.

### Before and after (the same 48 realistic tag sets)

| | Before | After |
|---|---|---|
| Distinct motif × palette combinations | 21 | 47 |
| Distinct motifs | 5 | 13 of 14 |
| Distinct hue pairs (ignoring order) | 3 | 21 |
| Round covers | 39 of 48 | 15 of 48 |

The tag sets follow how the agent tags: a theme first about 60% of the time, otherwise a
practice or a moment, then one to three more tags across groups.

### Evidence

- `src/components/meditation-cover.test.tsx`: the determinism test passes unchanged. New tests
  check that every tag has a unique pair, that round motifs stay under 40% across 2000 ids and
  every motif appears, and that every motif renders without `NaN` and with distinct markup
  at 48, 96, 160 and 320px.
- `src/lib/chat/tools.test.ts`: `"breathwork, inner-peace,breathwork,"` parses to
  `["breathwork", "inner-peace"]`; `"breathwork,python"` and a single-tag string are rejected.
  The emitted JSON schema still has `tags` as an array with the vocabulary enum.
- Grids: `docs/screenshots/42-cover-grid-dark.png` and `docs/screenshots/42-cover-grid-light.png`
  (48 covers at 112px, 16 at 48px, 3 at 320px). They were built from a temporary page that is
  not committed.
- Browser checks, in order: dark at desktop width, dark at 390px, then light at both, on
  `/discover` and a meditation page. No console errors (so no hydration mismatch) and no
  horizontal overflow at 390px. The 390px checks used a headless Chromium viewport, not
  device emulation.
- `impeccable detect` on the changed files reports nothing.

### For the operator

- Look at Discover and your library on a phone, in both themes, to judge the new palette
  against the real seeded set.
- The library and track rows render signed in; I checked the signed-out surfaces, which use
  the same component.
