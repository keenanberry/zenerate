# Supabase Keepalive + Backups

**Status:** Not started
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
- [ ] `src/app/api/cron/keepalive/route.ts` performs a trivial authenticated DB read (e.g. `select count(*) from meditations limit 1`)
- [ ] Route rejects requests without Vercel's cron secret — it must not be an open endpoint
- [ ] `vercel.json` declares a daily cron hitting it (Vercel Hobby permits one run per day, fired within an hour window — sufficient against a 7-day threshold)
- [ ] Cron confirmed firing in the Vercel dashboard after first deploy
- [ ] Failure is visible — a silently broken keepalive is worse than none, since it fails exactly when nobody is looking

**Backups**
- [ ] A documented `pg_dump` procedure in this file that can be run from a laptop against the production connection string
- [ ] Run at least once before launch, so a known-good restore path exists from day one
- [ ] Weekly cadence — a calendar reminder is acceptable; this does not need automating for a single-user app
- [ ] Dumps stored somewhere off Supabase (local disk plus a cloud drive is fine)
- [ ] A restore actually tested once against a scratch local database. An untested backup is not a backup

## Implementation notes

- The keepalive read should go through the service-role client so it never depends on a user session.
- Vercel cron authentication: Vercel sets an `Authorization: Bearer $CRON_SECRET` header when `CRON_SECRET` is set in project env. Check it and 401 otherwise.
- Storage objects are **not** covered by `pg_dump`. Generated MP3s live in the `meditation-audio` bucket and would need separate handling. For now, note that audio is regenerable from the script (at ElevenLabs cost) — so the scripts in Postgres are the thing that actually matters.
- Revisit Supabase Pro ($25/mo) when there is user data whose loss would matter. At that point this whole task becomes unnecessary and should be deleted rather than left running.

## Open questions

- **Whether a daily cron reliably prevents pausing is unverified.** Supabase describes the trigger as "low activity over a 7-day period" without publishing a threshold. A daily authenticated query should qualify, but this is a workaround rather than a supported feature. Watch for a pause notification during the first month and escalate to Pro if it fires.
