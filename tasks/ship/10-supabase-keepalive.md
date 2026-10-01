# Supabase Keepalive + Backups

**Status:** In progress — code done, two criteria need production
**Priority:** Ship-blocker
**Depends on:** 07 (production project), 09 (Vercel project for the cron)

## Why this blocks ship

Supabase **Free plan projects pause after 7 days of low activity**, and a paused project
requires a **manual restore from the dashboard** — it does not wake on the next request.

That directly defeats the primary use case. Open the installed PWA on a phone after a
quiet week and the app is dead until you get to a laptop and click restore. Paid plans
are never paused.

The decision (see `docs/superpowers/specs/2026-09-11-go-live-design.md`) is to stay on
Free and defeat the pause with a daily cron, accepting the weaker backup story and
mitigating it with a periodic dump. This task implements both halves.

## Acceptance criteria

**Keepalive**
- [x] `src/app/api/cron/keepalive/route.ts` — service-role `count` on `meditations` with `head: true` (the query is the point, not its result). `export const dynamic = "force-dynamic"`, because a cached response would touch no database at all and the keepalive would look healthy while doing nothing
- [x] Rejects anything without `Authorization: Bearer $CRON_SECRET`, compared in constant time. **Fails closed**: if `CRON_SECRET` is unset the route 503s rather than running unauthenticated, so a forgotten env var cannot quietly leave an open endpoint pointed at the database. 12 unit tests cover missing/wrong/prefix/no-scheme/absent-secret
- [x] `vercel.json` created (did not exist) with a daily cron at 07:00 UTC
- [ ] Cron confirmed firing in the Vercel dashboard after first deploy
- [x] Optional dead-man's-switch via `KEEPALIVE_PING_URL`. **Vercel's logs can show a run that failed; they cannot show a run that never happened** — cron disabled, `vercel.json` dropped by a deploy, project already paused. Those are the failures that bite. If the variable is set the route POSTs after a successful read, so a healthchecks.io-style service alerts when pings stop; unset, it is skipped entirely and there is no third-party dependency. A failed ping never fails the run, and a failed *read* never pings

**Backups**
- [x] Documented — but in **`docs/runbooks/backup-restore.md`**, not here. `tasks/ship/` becomes historical once shipped; a restore procedure has to be findable at 2am in a year. Covers the exact command, why each flag, what is *not* in the dump, and the production restore path
- [ ] Run at least once before launch, so a known-good restore path exists from day one
- [x] Weekly cadence documented in the runbook. **Your calendar reminder to create**
- [ ] Dumps stored somewhere off Supabase (local disk plus a cloud drive is fine)
- [x] **Tested.** `scripts/verify-backup.sh` restores a dump into a throwaway local database, prints per-table row counts, and drops it. Exercised end-to-end against a dump of the local stack: 0 unexpected errors, 2 users / 7 meditations / 3 collections / 7 collection_items / 5 favorites restored, 7 of 7 scripts intact. It refuses to run against a hosted Supabase URL, since it CREATEs and DROPs databases

## Still needs production

- [ ] **Cron confirmed firing in the Vercel dashboard** — only observable after deploy
- [ ] **Run the dump once against production**, so a known-good restore path exists from day one. Needs the production database password, so it is yours to run. Command is in the runbook; tell me the row counts and I will sanity-check them
- [x] `CRON_SECRET` set in Vercel — confirmed from outside: the deployed route returns **401** to an unauthenticated request. Had the secret been missing it would have returned **503**, because the route fails closed. The 401/503 distinction is what makes this verifiable without access to the env var itself

## Implementation notes

- The keepalive read should go through the service-role client so it never depends on a user session.
- Vercel cron authentication: Vercel sets an `Authorization: Bearer $CRON_SECRET` header when `CRON_SECRET` is set in project env. Check it and 401 otherwise.
- Storage objects are **not** covered by `pg_dump`. Generated MP3s live in the `meditation-audio` bucket and would need separate handling. For now, note that audio is regenerable from the script (at ElevenLabs cost) — so the scripts in Postgres are the thing that actually matters.
- Revisit Supabase Pro ($25/mo) when there is user data whose loss would matter. At that point this whole task becomes unnecessary and should be deleted rather than left running.

## Open questions

- **Whether a daily cron reliably prevents pausing is still unverified.** Supabase describes the trigger as "low activity over a 7-day period" without publishing a threshold. A daily authenticated query should qualify, but this is a workaround rather than a supported feature, and no amount of code can make it supported. Watch for a pause notification during the first month and escalate to Pro if it fires. The dead-man's-switch is what tells you if it does.
