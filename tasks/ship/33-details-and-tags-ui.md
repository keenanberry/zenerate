# Details Editing + Tag Display

**Status:** Not started
**Priority:** Phase 5, Wave B
**Phase:** 5
**Depends on:** 28; `tags.ts` from 29
**Skill:** `zenerate-design`
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

The agent sets the title, description and tags. The owner needs a light way to correct
them, the only hand-edit that survives, and everyone needs to see the tags.

## Scope

- **On the meditation page:**
  - The owner can edit the title and description inline, and add or remove tags from
    the vocabulary (a popover of the remaining tags; no free text).
  - The description shows beneath the title for everyone.
- **Tag pills** in Label type on the Badge base, shown on the meditation page, on
  `meditation-card.tsx` and on `track-row.tsx`.
- **Server action:** `updateMeditationDetails(id, { title?, description?, tags? })` in
  `src/lib/meditation/actions.ts`, validated against `TAGS` with 0 to 5 tags.
- Remove the `prompt` and `settings.focus` displays, since those were wizard fields.

## Acceptance criteria

- [ ] An action test rejects a tag outside the vocabulary, and rejects another user's
  meditation.
- [ ] Inline editing persists and refreshes; an edit to a public meditation shows to a
  signed-out visitor.
- [ ] Dark, light and phone checks are in the PR.
