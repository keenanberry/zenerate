# Drafts Owner-Only

**Status:** Not started
**Priority:** Phase 6. Blocks opening signups.
**Phase:** 6 (seed & open)
**Depends on:** 32 (versions), 36 (discover reads)

## Why

A revision in progress lives on the meditation row as `meditations.draft_script` (with
`draft_status`). Anon has table-wide `SELECT` on `meditations`
(`20261008000000_grant_anon_select_meditations.sql`), so on a public meditation anyone
with the public anon key can read the draft:
`GET /rest/v1/meditations?is_public=eq.true&select=draft_script`.
`discover_meditations` returns `m.*` too. `getMeditation` strips `draft_script` for
non-owners, but only from the page payload. Task 38 found this; `/privacy` therefore says
only that drafts are "never shown on the meditation's page". Signups are closed, so until
launch the exposure is limited to the operator's own drafts.

Column grants are not the fix: they break every `select *` anon makes, including
`discover_meditations` (security invoker, returns `m.*`).

## Scope

- Move `draft_script` and `draft_status` into an owner-only table (for example
  `meditation_drafts`, keyed by `meditation_id`, `on delete cascade`). RLS owner-only
  through the parent like `meditation_versions`, and no anon grant.
- Update everything that reads or writes them: `src/lib/audio/workflow.ts` (render and
  `promoteDraft`), `src/app/api/audio/generate/route.ts`, the studio tools in
  `src/lib/chat/tools.ts`, `getMeditation` / `getMeditationStatus` in
  `src/lib/meditation/actions.ts`, and `discover_meditations`.
- Migrate existing drafts, then drop the columns from `meditations`.
- Once true, `/privacy` can say drafts are never public, not only never shown.

## Acceptance criteria

- [ ] As anon, `psql` (`set role anon`) and REST both show no draft text is reachable for a
      public meditation with a draft.
- [ ] A draft render still leaves the current version playing, and promotes on success.
- [ ] Lint, tsc, tests and build pass.
