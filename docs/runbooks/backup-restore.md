# Runbook — Backup & Restore

Zenerate runs on the Supabase **Free** plan, which has no automated backups and no
point-in-time recovery. This procedure is the entire backup story. It is manual on
purpose — see *Why this is manual* at the bottom.

**Cadence:** weekly. A calendar reminder is sufficient for a single-user app.

**Retention:** 30 days at most, everywhere a dump lives. `/privacy` promises that backups
hold deleted data for no longer than that. See *Retention* below; the prune runs on its
own, so a missed backup never leaves an old dump behind.

---

## What is and isn't covered

| | Covered by `pg_dump`? |
|---|---|
| Meditations, scripts, collections, favorites | **Yes** |
| Auth users (`auth.users`) | **Yes**, with the flags below |
| Quota ledgers (`script_generation_events`, `audio_generation_events`) | **Yes** |
| **Generated MP3s in the `meditation-audio` bucket** | **No** |

Storage objects live outside Postgres and are not in the dump. That is a deliberate
accepted loss: **audio is regenerable from the script**, at ElevenLabs cost. The scripts
in Postgres are the thing that actually matters and cannot be recreated. If audio ever
becomes expensive enough to protect, that is a separate task, not a footnote here.

---

## Prerequisites

- `pg_dump` and `psql` (PostgreSQL 15+; this was written against 18.3)
- The production database connection string, from the Supabase dashboard:
  **Project Settings → Database → Connection string → URI**

The connection string contains the database password. Do not paste it into a file that
gets committed, a chat window, or a shell history you keep. Prefer reading it from an
environment variable set for the one command.

---

## Taking a backup

```bash
# Paste the URI from the dashboard. The leading space keeps it out of shell
# history in bash/zsh when HIST_IGNORE_SPACE / histignorespace is enabled.
 export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'

# Write to a dated file outside the repo.
mkdir -p ~/backups/zenerate
pg_dump "$SUPABASE_DB_URL" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --schema=public --schema=auth \
  --file="$HOME/backups/zenerate/zenerate-$(date +%Y-%m-%d).sql"
```

Why each flag:

| Flag | Reason |
|---|---|
| `--clean --if-exists` | The dump drops objects before recreating them, so a restore into a non-empty scratch database is idempotent rather than a pile of "already exists" errors |
| `--no-owner --no-privileges` | Supabase-managed roles do not exist on a local scratch database. Without these the restore fails on every `ALTER ... OWNER TO` |
| `--schema=public --schema=auth` | `public` is the app; `auth` is the users. Supabase's other internal schemas (`storage`, `realtime`, `vault`, …) are managed by the platform and restoring them into a scratch database is noise at best |

Then copy the file off this machine — local disk **plus** a cloud drive. A backup
that lives only on the machine that also holds the only copy of everything else is not
off-site. Copy with `cp -p` (or Finder), which keeps the file's date: the prune goes by
it, and a plain `cp` would give the copy today's date and another 30 days.

---

## Retention

Install the prune once per machine that holds dumps. Pass the off-site folder too, if it
is a folder on this Mac (a synced cloud drive):

```bash
./scripts/schedule-backup-prune.sh "$HOME/Library/CloudStorage/<drive>/zenerate"
```

It installs a launchd job (`com.zeneratestudio.backup-prune`) that runs daily at 09:00 and
at every login, and deletes every `zenerate-*.sql` dump and every deletion record (below)
that is 29 or more days old, so nothing reaches 30. It calls `/usr/bin/find` directly, so
it keeps working when this checkout moves. It also excludes `~/backups/zenerate` from
Time Machine, whose snapshots would otherwise keep pruned dumps. Run it again with the
full folder list to change the folders; `--dry-run` prints the job without installing it.

Check it works: `launchctl print gui/$(id -u)/com.zeneratestudio.backup-prune` shows the
last exit code, and `~/backups/zenerate/prune.log` holds any errors. An
`Operation not permitted` there for the cloud folder means macOS blocked background access
to it: give `/usr/bin/find` access under System Settings → Privacy & Security → Full Disk
Access, or keep the off-site copy somewhere the job can reach.

Two places the job cannot reach:

- **The cloud drive's trash.** Google Drive and iCloud keep deleted files for 30 days,
  so a pruned dump lives on there. Empty the trash of that folder after a prune, or use a
  drive or folder with no trash.
- **Any other copy.** An external disk or a second machine needs the job too, or no dumps.

---

## Deletion records

Restoring a dump brings back every account deleted after the dump was taken. To delete
them again, keep one empty file per handled deletion request, named by the user id. Its
date is the record; nothing else goes in it. When you delete an account:

```bash
mkdir -p ~/backups/zenerate/deletions
touch ~/backups/zenerate/deletions/<user-id>
```

The prune removes a record after 29 days. By then every dump older than the deletion is
gone too, so the record has nothing left to protect against.

---

## Verifying the backup

**An untested backup is not a backup.** This is the step that gets skipped, so it is one
command:

```bash
./scripts/verify-backup.sh ~/backups/zenerate/zenerate-2026-09-30.sql
```

It restores the dump into a throwaway local database, prints row counts per table, and
drops the database again. It never touches production or your local Supabase stack.

Check the counts look like the real thing — a dump that restores cleanly but contains
zero meditations is a successful restore of nothing.

**Expect a line like `18 of 18 were "does not exist"`.** The dump is taken with
`--clean`, so it opens with `DROP` statements that all fail against an empty scratch
database — and `DROP CONSTRAINT IF EXISTS` still errors when the *table* is missing,
because `IF EXISTS` covers the constraint, not its table. The script separates these
from real errors rather than hiding them. What matters is the **unexpected** count
being `0`.

---

## Restoring to production

This is the "something has gone badly wrong" path. Read it before you need it.

```bash
 export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'

# ALWAYS dry-run first: restore into a scratch database and look at it.
./scripts/verify-backup.sh ~/backups/zenerate/zenerate-YYYY-MM-DD.sql

# Only then, against production. The second command deletes again every account
# in the deletion records, in the same transaction, so no deleted account is ever
# live. Deleting the auth.users row cascades to every public table.
ids=$(ls ~/backups/zenerate/deletions 2>/dev/null | sed "s/.*/'&'/" | paste -sd, -)
reapply=()
[[ -n "$ids" ]] && reapply=(--command "delete from auth.users where id in ($ids)")
psql "$SUPABASE_DB_URL" --single-transaction --set ON_ERROR_STOP=on \
  --file ~/backups/zenerate/zenerate-YYYY-MM-DD.sql "${reapply[@]}"
```

`--single-transaction` with `ON_ERROR_STOP=on` means a failure part-way leaves production
exactly as it was, rather than half-restored. Never restore to production without both.
A malformed record (not a uuid) fails the whole restore; fix the file name and run it again.

If a deletion was handled but never recorded, delete that account again by hand now. The
records are only as complete as the habit of writing them.

After restoring, remember that **audio files are not in the dump**. Meditations whose
`audio_path` points at an object that no longer exists will render a "no audio" state
rather than break — `hydrateAudioUrl` returns null on a signing failure by design.

---

## Why this is manual

Supabase Pro ($25/mo) includes automated daily backups and removes the 7-day pause that
`src/app/api/cron/keepalive/route.ts` exists to work around. The decision to stay on Free
is recorded in `docs/superpowers/specs/2026-09-11-go-live-design.md`.

**When there is user data whose loss would matter, move to Pro.** At that point this
runbook and the keepalive route should both be *deleted*, not left running — a manual
backup procedure nobody performs is worse than an automated one, because it reads like
protection. Before deleting it:

- Check the plan's backup retention is 30 days or less. If it is longer, change the
  number in `/privacy` in the same PR.
- Keep the deletion records and the re-delete step, moved to wherever the restore
  procedure goes. A restored Supabase backup brings deleted accounts back too.
- Delete the old dumps. Leave the prune job running while it still expires the deletion
  records; once they live elsewhere, remove it with
  `launchctl bootout gui/$(id -u)/com.zeneratestudio.backup-prune` and delete its plist in
  `~/Library/LaunchAgents/`.
