# Runbook — Backup & Restore

Zenerate runs on the Supabase **Free** plan, which has no automated backups and no
point-in-time recovery. This procedure is the entire backup story. It is manual on
purpose — see *Why this is manual* at the bottom.

**Cadence:** weekly. A calendar reminder is sufficient for a single-user app.

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

Then move the file somewhere off Supabase — local disk **plus** a cloud drive. A backup
that lives only on the machine that also holds the only copy of everything else is not
off-site.

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

# Only then, against production:
psql "$SUPABASE_DB_URL" --single-transaction --set ON_ERROR_STOP=on \
  --file ~/backups/zenerate/zenerate-YYYY-MM-DD.sql
```

`--single-transaction` with `ON_ERROR_STOP=on` means a failure part-way leaves production
exactly as it was, rather than half-restored. Never restore to production without both.

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
protection.
