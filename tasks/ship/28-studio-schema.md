# Studio Schema + Operator Data Wipe

**Status:** Not started
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

- [ ] Migrations apply cleanly on `supabase db reset` locally, and `seed.sql` still loads.
- [ ] Every new table that a signed-out page reads (only `meditations` columns, plus 36's
  function) has an `anon` grant. The chat tables, `meditation_versions` and raw
  `meditation_plays` have none.
- [ ] RLS checks in psql:
  - As user B, every chat table query against user A's rows returns 0 rows.
  - As `anon`, `chats`, `chat_messages` and `meditation_versions` return 0 rows **or
    a permission error**, even when the meditation is public.
- [ ] `search @@ websearch_to_tsquery('english', 'sleep')` finds a meditation whose tag
  (not title) is `sleep`. If `array_to_string` is not immutable enough for a generated
  column, use a trigger-maintained column and say so in the Outcome.
- [ ] The runbook exists and is linked from `tasks/ship/README.md` Phase 4.
- [ ] `src/lib/meditation/types.ts` is updated, and `typecheck` passes.
