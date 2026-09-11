# Seed Data Prod Guard

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
`supabase/seed.sql` creates test users (`alice@example.com` / `bob@example.com`) and seed meditations/collections. If anyone accidentally runs `supabase db reset` against the production project, real user data gets wiped and replaced with test data. Even if `db reset` is never intentionally used in prod, the risk surface exists.

## Acceptance criteria
- [ ] `supabase/seed.sql` is only ever applied to local dev — document this explicitly at the top of the file and in the setup section of `CLAUDE.md` / `README.md`
- [ ] Verify `supabase db push` (migration-only) does NOT run seeds — it shouldn't, but confirm
- [ ] Consider splitting: keep schema/data needed for prod in migrations, keep only demo fixtures in `seed.sql`
- [ ] Ensure there's no code path where production DB could accidentally pick up seed data (GitHub Action, deploy hook, etc.) — audit and document
- [ ] Test account credentials (`password123`) must not work in production — since seed never runs there, this is automatic, but verify after task 07 that these accounts don't exist in prod DB
- [ ] Add a warning comment at the top of `seed.sql`: "Local dev only — never apply to production"

## Implementation notes
- Supabase CLI `db reset` applies migrations then seeds. `db push` applies only migrations — use this for prod.
- If there's storage bucket creation currently done via SQL in a migration, that's fine — migrations go to prod. Make sure no seed-like INSERTs live in migrations.
- Optional extra guard: check `current_database()` or an env-based role in `seed.sql` and abort if not local — brittle but doable.

## Open questions
- Do we want a script that creates a single demo/admin user in prod for internal testing? If yes, it's a separate admin tool, not `seed.sql`.
