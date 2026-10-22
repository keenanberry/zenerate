# Details Editing + Tag Display

**Status:** Done (PR open)
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

- [x] An action test rejects a tag outside the vocabulary, and rejects another user's
  meditation.
- [x] Inline editing persists and refreshes; an edit to a public meditation shows to a
  signed-out visitor.
- [x] Dark, light and phone checks are in the PR.

## Outcome

**What shipped**

- `updateMeditationDetails(id, { title?, description?, tags? })` in
  `src/lib/meditation/actions.ts`. Zod-validated: title 1–80 trimmed, description up to
  300 (blank stores `null`), tags from `TAGS` only, 0 to 5, no repeats. Writes only the
  fields given, filters on `user_id` as well as RLS, and throws `Meditation not found`
  when the update matches no row (someone else's meditation). Revalidates `/dashboard`,
  `/discover` and the meditation page.
- `src/lib/meditation/actions.test.ts`: 8 tests, including a tag outside the vocabulary,
  6 tags, a repeated tag, an empty title, another user's meditation, and a signed-out
  caller.
- `src/components/tag-pills.tsx`: `TagPills({ tags, size?: "sm" | "md" })` for task 36,
  plus a single `TagPill`. Secondary Badge, Label type (0.75rem, 500, 0.06em). Slugs no
  longer in the vocabulary are skipped, not shown raw.
- `src/components/meditation-details.tsx`: title, description and tags for everyone; the
  owner gets a pencil button that swaps in a form (title input, description textarea,
  removable tag pills, an "Add tag" popover of the remaining tags by group). Save / Cancel;
  Escape cancels, except inside the popover, where it only closes the popover.
- Mounts: the meditation page header (replaces the `h1` + `prompt` paragraph),
  `meditation-card.tsx` (description replaces the prompt, pills above the status row) and
  `track-row.tsx` (one line of whole pills replaces the prompt line, at every width).

**Decisions**

- The owner may set 0 tags; the agent's `setDetails` still requires 2 to 5.
- `settings.focus` had no visible display left. It still feeds the share-card
  description in `src/lib/seo/metadata.ts`; that is metadata, not a display, so it is
  untouched. Switching the share card to `description` is a small follow-up.
- Track rows clip pills to one line by hiding whole pills that would wrap
  (`max-h-[18px] overflow-hidden`), never cutting one in half.

**Evidence**

- Local, signed in as the owner: edited the title, removed a tag and added one through
  the popover; the row in Postgres had the new title and `{sleep,bedtime,letting-go}`,
  and a reload showed them. A cookie-less `curl` of the same public page (a signed-out
  visitor) returned the new title, description and tags with `editable:false`.
- Dark desktop, dark 390px (iframe at 390 wide), light desktop and 390px: page view, edit
  form, library cards and track rows. Screenshots are in the PR.
- `impeccable detect` on the changed files: no findings. Palette-class grep: empty.

**For the operator**

- No migration. Check on a phone that the tag remove buttons are comfortable to tap.
