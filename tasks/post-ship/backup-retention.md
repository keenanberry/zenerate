# Enforce 30-Day Backup Retention

**Status:** Done* (2026-10-25). *Operator: install the prune job and start the deletion
records (`tasks/OPERATOR-TODO.md`, section 6)
**Priority:** Pre-launch. Promoted to ship task 52 on 2026-10-23

## Why it matters
`/privacy` (task 15) promises that backups may contain deleted data **for up to 30 days**
before it is removed. Nothing enforces that today. `docs/runbooks/backup-restore.md`
writes a weekly `pg_dump` to `~/backups/zenerate/` and never prunes it, so every dump is
kept forever. Each dump includes `auth.users`, which means email addresses and password
hashes, on a personal machine.

## Scope sketch
- **Prune.** Add a step to the runbook that deletes dumps older than 30 days on every
  backup run:
  `find ~/backups/zenerate -name 'zenerate-*.sql' -mtime +30 -delete`.
  Better still, automate the prune so it does not depend on remembering.
- **Restores can resurrect deleted users.** Restoring a dump brings back any account
  deleted after it was taken. Add a runbook step: after a restore, re-apply every
  deletion request handled since the dump's date. This implies keeping a minimal log of
  deletion requests (date and user id, no content). See `account-deletion.md`.
- **On moving to Supabase Pro** (the runbook's own exit condition), confirm the plan's
  automated backup retention is 30 days or less. If it isn't, change the number in
  `/privacy` in the same PR.

## Done when
No dump older than 30 days exists anywhere, the prune happens without relying on memory,
and the restore procedure re-applies deletions.

## Outcome
- **Prune, automated.** `scripts/schedule-backup-prune.sh` installs a launchd job that runs
  `/usr/bin/find` daily at 09:00 and at login, deleting `zenerate-*.sql` dumps and
  deletion records 29 or more days old, so none reaches 30. It takes the off-site folder
  as an argument, and excludes `~/backups/zenerate` from Time Machine. The job calls
  `find` directly, so it survives this checkout moving. Checked: the plist from
  `--dry-run` passes `plutil -lint`, and the `find` expression run against files dated 0,
  27, 28, 29, 30 and 40 days back keeps 0–28 and deletes 29+, leaving other files alone.
  The job itself was not installed on this machine; that is the operator's.
- **Deletion records.** One empty file per handled deletion, named by user id, in
  `~/backups/zenerate/deletions/`, outside the database so a restore cannot roll it
  back. Pruned on the same schedule: by then every dump older than the deletion is gone.
- **Restore re-applies deletions** in the same transaction as the restore, so a deleted
  account is never live again. Checked against a scratch copy of the local stack: one
  record deleted that user and cascaded their 17 meditations; no records restored all 5
  users; a malformed record failed and rolled the whole restore back.
- **What the job cannot reach**, written into the runbook: a cloud drive's trash (Google
  Drive and iCloud keep deleted files 30 days) and any copy on another disk or machine.
- **Pro.** The runbook's exit section now says to check Pro's retention against
  `/privacy`, keep the re-delete step, and remove the job only after the records move.
- `/privacy` unchanged: it already says 30 days, which is now true.
