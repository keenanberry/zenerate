# Production Supabase Project

**Status:** Not started
**Priority:** Ship-blocker
**Related:** 08 (transactional email), 10 (keepalive + backups)

## Why this blocks ship
Everything currently runs against local Supabase (`127.0.0.1:54321`). Production needs its own project with migrations applied, the `meditation-audio` storage bucket created, and env vars wired into Vercel.

## Acceptance criteria
- [ ] Production Supabase project created
- [ ] All migrations in `supabase/migrations/` applied (via `supabase db push` or linked project)
- [ ] `meditation-audio` storage bucket exists with correct RLS/public-access config matching local
- [ ] Email auth enabled. **SMTP is task 08** — Supabase's built-in sender is rate-limited to a handful of emails/hour and is not intended for production; do not rely on it
- [ ] Production `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set in Vercel env vars
- [ ] Redirect URLs (`/auth/callback`, reset password return URL) configured in Supabase auth settings for the production domain
- [ ] Smoke test: sign up, sign in, create a meditation against prod DB

## Implementation notes
- Use `supabase link --project-ref <ref>` locally, then `supabase db push` to apply migrations.
- Storage bucket: check `supabase/migrations/` for the bucket creation — if it's SQL, it applies with `db push`; if it's a console-only action, document it.
- Do NOT run `supabase/seed.sql` against prod (covered by task 04).
- `service_role` key must only live in Vercel env vars — never in client code.

## Open questions
- Any existing Supabase projects on the work account that collide with naming?

## Plan note
Staying on the **Free** plan (see `docs/superpowers/specs/2026-09-11-go-live-design.md`). Free projects pause after 7 days of low activity and require a *manual* dashboard restore — task 10 adds a daily keepalive cron plus a weekly `pg_dump` to compensate. Revisit Pro ($25/mo) when there is data worth missing.
