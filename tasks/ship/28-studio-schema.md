# Studio Schema + Operator Data Wipe

**Status:** Done (PR open, awaiting review)
**Priority:** Phase 4, Wave A. The schema is final from day one, because seeded rows are never migrated.
**Phase:** 4 (studio)
**Depends on:** nothing (can run beside 27)
**Blocks:** 29, 31, 32, 33, 35, 36
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

Chats, versions, tags, descriptions, plays and house picks all need columns or tables.
The operator seeds 24 meditations once Wave A lands, and those rows must not need a
migration afterwards, so every Wave B column ships now even though its UI comes later.

## The shape (decided here so parallel workers can build against it)

**Versions keep today's columns as the live version.** `meditations.script`,
`audio_path`, `status` and `settings` stay where they are and always describe the
*current* version, so the audio workflow, the public page and every existing read stay
unchanged. Revisions made after audio exists go to a new `draft_script` column. A
finished render promotes the draft, and only then is the old script and audio archived.
Until then, a public page keeps showing the old version.

| Object | Columns / notes |
|---|---|
| `meditations` + | `description text`, `tags text[] not null default '{}'` (GIN index), `draft_script text`, `is_featured boolean not null default false` (house picks, set by the operator in SQL), `search tsvector` generated from title, description, tags and script (GIN index). `prompt` becomes nullable. |
| `meditation_versions` | `id uuid`, `meditation_id` → meditations on delete cascade, `script text not null`, `audio_path text`, `voice text`, `generation_meta jsonb`, `created_at`. **Archived** versions only; the current one is the meditations row. Owner-only RLS, no `anon` grant. |
| `chats` | `id uuid`, `user_id` → auth.users on delete cascade, `meditation_id` → meditations, `unique`, nullable (null means a draft chat with no script yet), `title text`, `created_at`, `updated_at`. Owner-only RLS for every operation. **No `anon` grant, ever.** |
| `chat_messages` | `id text primary key` (AI SDK server-generated ids), `chat_id` → chats on delete cascade, `role text`, `parts jsonb not null`, `created_at`. Owner-only through `chats`. **No `anon` grant.** |
| `meditation_plays` | `id`, `meditation_id` → meditations on delete cascade, `user_id` → auth.users, `played_at`. Authenticated insert of own rows only. Raw rows are not readable by `anon`. 36 adds a `security definer` aggregate function. |

- Deleting a meditation deletes its versions, and its chat's `meditation_id` goes to null
  (`on delete set null`), so the conversation survives and can restart the meditation.
- Storage: archived versions' audio files stay in the `meditation-audio` bucket. Deleting
  a version must delete its object, because storage does not cascade (see
  `tasks/post-ship/account-deletion.md`).
- Types: extend `Meditation` in `src/lib/meditation/types.ts` with `description`,
  `tags`, `draft_script` and `is_featured`, and add `MeditationVersion`, `Chat` and
  `ChatMessageRow`.

## The operator wipe (runbook, run by the operator, before this migration reaches production)

Add `docs/runbooks/operator-data-wipe.md`:
1. Download any audio worth keeping from the app's Download button, and copy any
   scripts worth keeping.
2. Delete the operator's own rows: `meditations` (cascades to favorites and
   collection items), `collections`, and their `audio_generation_events` and
   `script_generation_events` (look the user id up first, then filter by it).
3. Delete the operator's objects under their prefix in the `meditation-audio` bucket.
4. **Never `supabase db reset` against production.** Confirm the counts before and after.

## Acceptance criteria

- [x] Migrations apply cleanly on `supabase db reset` locally, and `seed.sql` still loads.
- [x] Every new table that a signed-out page reads (only `meditations` columns, plus 36's
  function) has an `anon` grant. The chat tables, `meditation_versions` and raw
  `meditation_plays` have none.
- [x] RLS checks in psql:
  - As user B, every chat table query against user A's rows returns 0 rows.
  - As `anon`, `chats`, `chat_messages` and `meditation_versions` return 0 rows **or
    a permission error**, even when the meditation is public.
- [x] `search @@ websearch_to_tsquery('english', 'sleep')` finds a meditation whose tag
  (not title) is `sleep`. If `array_to_string` is not immutable enough for a generated
  column, use a trigger-maintained column and say so in the Outcome.
- [ ] The runbook exists and is linked from `tasks/ship/README.md` Phase 4. *(The runbook exists. The README link is the coordinator's: workers don't edit that file.)*
- [x] `src/lib/meditation/types.ts` is updated, and `typecheck` passes.

## Outcome

**What shipped**

- `supabase/migrations/20261021000000_studio_schema.sql`: the shape table above, plus
  RLS, indexes and grants. `seed.sql` loads unchanged.
- `src/lib/meditation/types.ts`: `Meditation` gains `description`, `tags`, `draft_script`
  and `is_featured`, and `prompt` is `string | null`; new `MeditationVersion`, `Chat` and
  `ChatMessageRow` (whose `role` and `parts` are typed from the AI SDK's `UIMessage`).
- `src/components/track-row.tsx`: `m.prompt?.split(...)`, the one typecheck fix the
  nullable `prompt` needed. Later tasks replace that line with `description` anyway.
- `docs/runbooks/operator-data-wipe.md`.

**Decisions and changes from the shape table**

- **`search` is trigger-maintained, not generated.** `array_to_string` is `STABLE`
  (`pg_proc.provolatile = 's'` on local Postgres 17.6), and a generated column using it
  fails with `generation expression is not immutable`. `meditations_set_search()` fills it
  on insert and on updates to title, tags, description or script, as the ledgers' year_month
  triggers do. Weights: title A, tags B, description C, script D. It indexes the current
  `script`, not `draft_script`, so search finds what the public page shows.
- **`chat_messages.metadata jsonb` (nullable), added.** The AI SDK persists a UIMessage as
  id, role, parts and metadata; leaving metadata out would mean a migration the first time
  the chat route attaches any (timings, model, token usage).
- **`chat_messages.created_at` defaults to `clock_timestamp()`,** not `now()`. `now()` is
  fixed for a transaction, so a turn saved in one insert would give user and assistant
  messages the same timestamp and no stable order.
- **`chat_messages.role` is checked** against `system`, `user`, `assistant` (UIMessage's
  roles).
- **`meditation_plays.user_id` cascades on user delete**, like every other user_id FK, so
  account deletion stays a single delete.
- **Chats can only point at the caller's own meditation** (insert and update `with check`).
  Without it, because `meditation_id` is unique, user B could attach a chat to A's public
  meditation and squat the one slot A needs.
- **Versions' policies test `meditations.user_id = auth.uid()` explicitly.** A bare
  `exists()` against meditations runs under its select policy, which also passes public
  rows, so it would publish a public meditation's archive.
- **Plays: insert own rows for a meditation the caller can see** (own or public), and
  **select own rows** (for Picked for you). No update or delete.
- **Grants start from zero.** Each new table first revokes everything from `public`,
  `anon` and `authenticated`, then grants narrowly: versions `select, insert, delete`
  (archives are never edited), chats and messages the full set (messages are upserted),
  plays `select, insert`. Locally Supabase's default privileges hand `anon` everything on a
  new table, so without the revoke "no anon grant" would be true only in production and the
  local psql check would prove nothing. With it, local and production match.
- `chats.updated_at` has no trigger, matching the other tables: the chat route sets it.

**Evidence** (local, after `supabase db reset`; fixtures inserted and rolled back in one
transaction, script in the PR body)

- Grants: `anon` holds nothing on `chats`, `chat_messages`, `meditation_versions` or
  `meditation_plays`.
- As user B: 0 rows from each of A's chats, messages, versions and plays (A's public
  meditation itself is visible, as a sanity check). B's inserts against A's chat, messages,
  versions, a play in A's name, and a chat on A's meditation all fail RLS; B's update and
  delete touch 0 rows. B can record its own play of A's public meditation. As A, every
  row is visible.
- As `anon`: `permission denied` on all four tables, while the public meditation itself
  reads fine.
- Tag search: a public meditation titled "Evening Unwind" with tags `{sleep,evening}` and
  no "sleep" anywhere else matches `search @@ websearch_to_tsquery('english', 'sleep')`.
  Updating a row's tags updates its vector; seeded rows got vectors.
- Deleting a meditation deletes its versions and sets its chat's `meditation_id` to null.
- The runbook's SQL ran end to end against Alice locally (rolled back).

**For the operator**

- Run `docs/runbooks/operator-data-wipe.md` **before** `supabase db push` takes this
  migration to production. Note it corrects the plan above on one point: audio is **not**
  under a per-user prefix. Files are `<meditation_id>.mp3` at the bucket root, so the
  runbook lists them from the rows before anything is deleted, and deletes them through the
  Storage API or dashboard (SQL deletes on `storage.objects` are blocked by
  `protect_objects_delete`).
- After the push, check the production grants match:
  `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('chats','chat_messages','meditation_versions','meditation_plays') and grantee = 'anon';`
  must return no rows.
- The repo has no `npm run typecheck` script; `npx tsc --noEmit` is what ran.

