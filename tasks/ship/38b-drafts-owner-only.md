# Drafts Owner-Only

**Status:** Done (PR A #64 migration; PR B code + drop). Awaiting merge in that order.
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

- [x] As anon, `psql` (`set role anon`) and REST both show no draft text is reachable for a
      public meditation with a draft.
- [x] A draft render still leaves the current version playing, and promotes on success.
      (Locally up to `Sandbox.create`; promotion itself by the workflow tests.)
- [x] Lint, tsc, tests and build pass.

## Outcome

Drafts live in **`meditation_drafts`** (`meditation_id` primary key, `on delete cascade`;
`script`; `render_status` null / `processing` / `failed`; `updated_at`). RLS is owner-only
through the parent, with the explicit `m.user_id = auth.uid()` test. `authenticated` and
`service_role` get DML; `anon` gets nothing. `meditations.draft_script` and `draft_status`
are dropped.

Shipped in two PRs, because migrations apply on merge while the code on `main` still
uses the old columns:

- **PR A, #64** (`20261023000038_drafts_owner_only.sql`, additive). Creates the table,
  backfills it, and installs a **mirror trigger** on `meditations` that copies every
  later write to `draft_script` / `draft_status` into the table, in the same transaction.
  The table therefore stays exact for as long as the old code runs.
- **PR B** (`20261024000038_drop_meditation_draft_columns.sql` plus the code). The code
  reads and writes only the table. The migration re-copies drafts that are on the old
  columns but missing from the table. It never overwrites a table row and skips a draft
  whose text equals the live script, so it cannot resurrect a draft the new code
  promoted, whichever of Vercel and the migration lands first. It then drops the
  trigger and the columns.

Decisions:

- **Mirror trigger instead of a blind upsert in PR B.** A blind upsert would overwrite
  anything the new code wrote if Vercel went live before the migration applied. With the
  mirror, PR B's re-copy is a safety net expected to insert nothing.
- **Promotion is ordered and idempotent without a SQL function.** Archive, then update the
  meditation (skipped when it already carries this render's `audio_path`, which is unique
  per render), then delete the draft. A step retry from any point finishes correctly.
- **Nothing on `meditations` changes during a draft's life.** `writeScript` no longer bumps
  `meditations.updated_at` for a draft, and the route's compare-and-set and `markFailed`
  touch only the draft row, so anon cannot even infer that a draft or render exists.
- `writeScript` still returns `savedAs: "draft_script"`. Persisted chats and the model
  already know that value, and it is only a label.
- `discover_meditations` needed no change: `setof meditations` with `m.*` follows the
  table's columns.
- `/privacy` now says a revision in progress is visible only to the owner, the same as the
  chat and earlier versions.

Evidence (an isolated local Supabase stack with its own project id and ports, so the
shared database was never touched):

- PR A rehearsed in production order: pre-existing drafts were copied, and each of the
  old code's writes was replayed (`writeScript` and the CAS as the owner under RLS,
  `markFailed` and `promoteDraft` as service_role). The table followed every one.
- PR B rehearsed with a mirrored draft, a draft the mirror missed, a draft already
  promoted by new code, and a newer draft written by new code. Each one ended correctly.
- Anon on a public meditation with a draft in progress:
  - psql: `draft_script` does not exist, and `meditation_drafts` gives permission denied.
  - REST: `select=draft_script` returns 42703, and `/meditation_drafts` returns 42501.
  - `select=*`, `rpc/discover_meditations` and the signed-out page HTML contain no draft
    text.
  - Another signed-in user reads 0 draft rows, and the owner reads the draft.
- Studio flow in the browser: write, then simulate a first render in SQL, then revise. The
  draft went to the table and the live script was unchanged. **Make audio** then took
  the draft from `processing` to `failed` at `Sandbox.create` (no local Vercel
  credentials). The meditation stayed `completed`, and the free retry went through the
  `failed` → `processing` CAS.
- The full migration chain applies from scratch with `supabase db reset` (isolated stack).

For the operator:

- Merge #64, confirm it applied (the counts of `meditations.draft_script is not null` and
  `meditation_drafts` rows match), then merge PR B **while no render is in flight**.
- After PR B applies, confirm: `select column_name from information_schema.columns where
  table_name = 'meditations' and column_name like 'draft%'` returns nothing.
- Production REST check with the public key:
  `GET /rest/v1/meditation_drafts?select=*` should return 42501, and
  `GET /rest/v1/meditations?is_public=eq.true&select=draft_script` should return 42703.
