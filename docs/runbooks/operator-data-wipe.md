# Runbook — Operator Data Wipe

Once the studio schema (`supabase/migrations/20261021000000_studio_schema.sql`, task 28)
is in production, and before seeding starts, the operator deletes everything in their own account. Old meditations
get no chat and nothing migrates them (see the spec,
`docs/superpowers/specs/2026-10-20-agentic-studio-design.md`), so the account starts empty
and the 24 house meditations are made fresh through the studio.

This is a **targeted delete of one user's rows and storage objects**, run by hand. It is
not a reset.

> **Never run `supabase db reset` against production.** It drops every table and applies
> `supabase/seed.sql`, which creates test accounts with a known password. Nothing in this
> runbook needs it.

**When:** once, after the studio PRs are merged and before the house meditations are made.
Production migrations deploy through the **Supabase GitHub integration on every push to
`main`** (see `tasks/ship/07-production-supabase.md`), so the migration is already applied
by the time you read this. That is fine, because it only adds columns and tables. The
account itself stays; only its content goes.

Every step works from the dashboard: **Storage** for the files, the **SQL Editor** for the
rows. While the operator is the only account (`select id, email from auth.users;`), the
user-id filters below can be dropped, but keep step 3's order: empty the bucket before
deleting rows.

---

## Prerequisites

- `psql`, and the production connection string from the dashboard
  (**Project Settings → Database → Connection string → URI**), handled as in
  [`backup-restore.md`](backup-restore.md): in an environment variable, never in a file
  or a shell history you keep. The dashboard's **SQL Editor** works for every SQL step
  too.
- The service-role key (**Project Settings → API**), for step 4 only.
- **A fresh backup**, taken with [`backup-restore.md`](backup-restore.md). The wipe cannot
  be undone any other way, and the backup does not include audio, which is why step 1
  exists.

```bash
 export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'
```

---

## 1. Keep what's worth keeping

In the app, open each meditation worth keeping:

- **Audio:** press **Download** on the player. The bucket is emptied in step 4, and audio
  is not in the database backup.
- **Script:** copy it into a file outside the repo. (It is also in the backup, but a file
  is easier to read.)

## 2. Look up the user id and count what's there

Every step filters by this id. Look it up; don't type it from memory.

```sql
select id, email from auth.users where email = '<operator email>';
```

Then, with the id in place of `<operator id>`, record the counts **before**:

```sql
select 'meditations' as tbl, count(*) from public.meditations where user_id = '<operator id>'
union all select 'collections', count(*) from public.collections where user_id = '<operator id>'
union all select 'collection_items', count(*) from public.collection_items ci
  join public.collections c on c.id = ci.collection_id where c.user_id = '<operator id>'
union all select 'favorites', count(*) from public.favorites where user_id = '<operator id>'
union all select 'audio_generation_events', count(*) from public.audio_generation_events where user_id = '<operator id>'
union all select 'script_generation_events', count(*) from public.script_generation_events where user_id = '<operator id>'
union all select 'storage objects', count(*) from storage.objects o
  where o.bucket_id = 'meditation-audio'
    and (o.name like '<operator id>/%'
         or exists (select 1 from public.meditations m
                    where m.user_id = '<operator id>' and o.name = m.id::text || '.mp3'));
```

Keep this output. Step 6 compares against it.

## 3. List the audio objects, before any row is deleted

Since task 32, audio lives in one folder per user: `uploadAudio` writes
`<user_id>/<meditation_id>/<render_id>.mp3`, so the operator's files are everything under
the `<operator id>/` prefix, archived versions included, and the prefix still says whose
they are after the rows are gone. Audio rendered before task 32 sat at the bucket root as
`<meditation_id>.mp3`, and the only link from such a file to its owner is the meditation
row, so list first, while the rows exist:

```sql
select o.name
from storage.objects o
where o.bucket_id = 'meditation-audio'
  and (o.name like '<operator id>/%'
       or exists (select 1 from public.meditations m
                  where m.user_id = '<operator id>' and o.name = m.id::text || '.mp3'))
order by o.name;
```

Save the list (the SQL Editor can download it as CSV).

## 4. Delete the audio objects

Storage does not cascade from Postgres, and Supabase blocks deleting from
`storage.objects` in SQL. Delete through the Storage API or the dashboard instead. Doing
this before the rows means a failure leaves rows that still say what to delete, never files
nobody can trace.

**Dashboard:** **Storage → meditation-audio**, delete the `<operator id>` folder, then any
root-level files from step 3.

**Or the API**, with the names from step 3 (it accepts many per call):

```bash
 export SUPABASE_URL='https://<ref>.supabase.co'
 export SERVICE_ROLE_KEY='<service role key>'

curl -sS -X DELETE "$SUPABASE_URL/storage/v1/object/meditation-audio" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"prefixes": ["<operator id>/<meditation id>/<render id>.mp3", "<meditation id>.mp3"]}'
```

The delete takes full object names, not folders; paste the names from step 3.

Re-run the step 3 query. It must return no rows.

## 5. Delete the rows

In one transaction, so a mistake rolls back whole:

```sql
begin;

delete from public.audio_generation_events where user_id = '<operator id>';
delete from public.script_generation_events where user_id = '<operator id>';
delete from public.favorites where user_id = '<operator id>';
-- Cascades to collection_items.
delete from public.collections where user_id = '<operator id>';
-- Cascades to favorites and collection_items that point at these meditations
-- (anyone's), and to any audio_generation_events left.
delete from public.meditations where user_id = '<operator id>';

-- Run the step 2 count query here. Every row must be 0.
-- If any is not, `rollback;` and find out why before trying again.

commit;
```

Deleting the generation events also resets the operator's monthly quota counts. That is
intended: the seeding starts from zero.

## 6. Confirm

Run the step 2 count query once more, outside the transaction. Every count is 0.

Then check the bucket for files no meditation points at (left over from older deletes,
which never removed their audio):

```sql
select o.name
from storage.objects o
where o.bucket_id = 'meditation-audio'
  and not exists (
    select 1 from public.meditations m
    where o.name in (m.audio_path, m.id::text || '.mp3')
  )
  and not exists (
    select 1 from public.meditation_versions v where v.audio_path = o.name
  );
```

While the operator is the only user, anything listed here is theirs to delete the same way
as step 4.

## 7. No migration step

The GitHub integration already applied the studio migration on merge. Confirm with
`select count(*) from public.chats;`, which returns 0 rather than an error. If you ever do
push migrations by hand, **never pass `--include-seed`** against production; it would
apply `supabase/seed.sql` and its known-password test accounts.
