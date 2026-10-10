# Tags and Filters

**Status:** Not started
**Priority:** Post-ship. Filed 2026-10-09 during the launch sound check.
**Related:** `docs/ui-roadmap.md` (Discover category and duration filters, dashboard
search), [Public content moderation](./public-content-moderation.md),
[Conversational script refinement](./conversational-script-refinement.md)

## Why it matters

Finding a meditation again, or finding anyone's on `/discover`, has two handles today: the
title, and free-text search on Discover. Type and duration are structured but not
filterable; the focus is free text the author happened to write; nothing describes what
the script is actually about. Once Discover holds more than a handful of public
meditations, "sleep", "grief" or "before a hard conversation" need to be a click, not a
word the author chose.

## Direction: classify, then let the owner adjust

User tagging is the obvious design and the wrong first cut. Free-form tags fragment
("anxiety" / "anxious" / "stress"), they are one more field to fill in a flow that is
meant to be one line, and at hobby scale there is no crowd to converge them. Instead:

- **A controlled vocabulary**, 20 to 40 tags in `src/lib/meditation/tags.ts`: themes
  (sleep, anxiety, gratitude, focus, grief, transition, self-compassion), practices
  (breath, body, visualization, mantra, loving-kindness), moments (morning, evening,
  before sleep, at work). One source read by the classifier prompt, the filter UI and a
  test. A fixed list is what makes filters possible.
- **Assigned by the model from the script**, after `script_ready`: a structured-output
  call (AI SDK `generateObject`, a small model) returning 2 to 5 tags from the vocabulary
  and a one-line summary. Fire-and-forget off the save path, never blocking it, the same
  rule moderation will follow. Fractions of a cent per meditation. Backfill existing
  scripts once.
- **The owner can remove a tag or add one from the same list.** No free text, so Discover
  stays clean without a moderation queue.
- **Filters**: tag pills on `/discover` and the Library, combinable with the type and
  duration filters the roadmap already lists; tags on the meditation page and track rows.

## Scope sketch

- Migration: `meditations.tags text[] not null default '{}'` with a GIN index.
- `src/lib/ai/classify.ts`, called from the script-save action; a script to backfill.
- UI: tag pills in Label type on the Badge base; a filter bar; owner editing on the
  meditation page.
- Worth shipping first, or alongside: Postgres full-text search over title, prompt and
  script (a generated `tsvector` column) covers "the one about X" in the Library with no
  tagging at all.

## Decisions to make

- Vocabulary size, and whether moments (morning, evening) are tags or their own facet.
- Whether a user may propose a tag (to the operator, never live).
- Classify from the script alone, or prompt plus script. The script is the truth; the
  prompt says what was asked for.
