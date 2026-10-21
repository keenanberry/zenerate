# Designed Cover System

**Status:** Not started
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

- [ ] A determinism test: the same input gives the same output markup.
- [ ] Dark and light: covers sit inside the Nocturne grounds without glowing or muddying.
- [ ] `DESIGN.md` records the cover rule.
- [ ] Screenshots of 24 sample covers in a grid in the PR, so the set's variety is
  visible.
