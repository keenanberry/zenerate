# Runbook — Account Deletion Request

Until self-serve deletion ships (`tasks/post-ship/account-deletion.md`), `/privacy` sends
deletion requests to `privacy@zeneratestudio.com` and promises a response within 30 days.
This is the whole procedure. Steps 1–3 work from the Supabase dashboard; step 4 runs on
each Mac that holds backup dumps.

**Order matters: audio, then the account, then the record.** Storage does not cascade
from the database, and once the account is gone the user id is the only thing that says
whose files they were.

---

## 1. Check the request

- It came from the address on the account; `/privacy` asks for that. If it did not, reply
  asking them to write from that address, and delete nothing yet.
- **SQL Editor**, to get the user id. Copy it from the result; every later step uses it.

  ```sql
  select id, email, created_at from auth.users where email = '<email>';
  ```

## 2. Delete their audio

**Storage → `meditation-audio`**: delete the folder named by the user id. It holds every
render, earlier versions included (`<user id>/<meditation id>/<render id>.mp3`).

Then check that nothing is left. This must return 0:

```sql
select count(*) from storage.objects
where bucket_id = 'meditation-audio'
  and (name like '<user id>/%'
       or name in (select id::text || '.mp3' from public.meditations
                   where user_id = '<user id>'));
```

The second condition catches audio rendered before task 32, which sat at the bucket root.
The bucket was wiped on 2026-10-21, so expect none; if any show up, delete those files by
name in the same bucket.

## 3. Delete the account

**Authentication → Users**: find the user, then **Delete user**.

Deleting the `auth.users` row cascades every `public` table: meditations with their drafts
and earlier versions, chats and messages, plays, favorites, collections and usage records.
Every `user_id` foreign key in `supabase/migrations/` is `on delete cascade` (checked
2026-11-16; check again if a migration adds a table that holds user data).

This must return 0:

```sql
select count(*) from public.meditations where user_id = '<user id>';
```

## 4. Record the deletion

On every machine that holds dumps:

```bash
mkdir -p ~/backups/zenerate/deletions
touch ~/backups/zenerate/deletions/<user id>
```

The empty file is the record, and its date is what counts. Restoring a dump re-deletes
every recorded account ([`backup-restore.md`](backup-restore.md), "Restoring to
production"); an account without a record comes back. The prune removes a record after 29
days, by when every dump older than the deletion is gone too.

The record still matters after the move to Supabase Pro, because a restored Supabase
backup brings the account back as well (`backup-restore.md`, "Why this is manual").

## 5. Reply

Tell them the account and everything in it are deleted, and that backups may hold
deleted data for up to 30 days before they are removed, as `/privacy` says.
