# Enforce 30-Day Backup Retention

**Status:** Not started
**Priority:** Post-ship

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
