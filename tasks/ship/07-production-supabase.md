# Production Supabase Project

**Status:** Done, except one smoke-test step blocked on the Anthropic key
**Priority:** Ship-blocker
**Related:** 08 (transactional email), 10 (keepalive + backups)

## Why this blocks ship
Everything currently runs against local Supabase (`127.0.0.1:54321`). Production needs its own project with migrations applied, the `meditation-audio` storage bucket created, and env vars wired into Vercel.

## Acceptance criteria
- [x] Production Supabase project created — ref `xnvqjqobegcpkigkmoct`
- [x] All migrations applied, via the **Supabase GitHub integration** rather than a manual push. Connecting the integration does not apply anything on its own — it deploys on push to `main`, so the first merge after connecting is what ran them. Confirmed in the deploy log and by probing all six tables
- [x] `meditation-audio` bucket exists. **Created by the integration from `config.toml`**, not by hand — `[storage.buckets.meditation-audio] public = false` is in that file, so the bucket is declarative and reproducible. This answers the task's open question: it is *not* a console-only action after all, provided the config block exists
- [x] Bucket is **private** — `public = false` in `config.toml`, and verified from outside: an anonymous request for the bucket returns `NoSuchBucket`. **Not independently verified: that no `storage.objects` policies exist.** Nothing in the repo creates any, and none were added by hand, but this was confirmed by absence rather than by inspection. Worth an explicit check in the dashboard, because a single object policy silently bypasses the entire signed-URL design
- [x] Email auth enabled — signup and sign-in both verified end to end in production. SMTP is still task 08; the built-in sender is what delivered the confirmation, and it shows (see 08)
- [x] Email confirmation **enabled** — proven by a real confirmation email arriving for the first signup. This is the control that stops one visitor farming the per-user script quota with unlimited unconfirmed accounts, so it mattering was never hypothetical
- [x] All three set in Vercel. `SUPABASE_SERVICE_ROLE_KEY` was the **last blocker** — it was missing on first deploy, and because `hydrateAudioUrls` constructs the service-role client before checking whether there are any paths to sign, the dashboard threw even with zero meditations. That eager construction is correct: deferring it would have hidden the misconfiguration until the first meditation with audio
- [x] Redirect URLs configured, under **Authentication → URL Configuration**. Note the apex 308-redirects to `www`, so `window.location.origin` resolves to `https://www.zeneratestudio.com` and the `www` form is the one that must be allowlisted. Trailing slashes are **not** normalised — `https://x.com` and `https://x.com/` are stored as distinct entries
- [x] Sign up and sign in verified in production. **Creating a meditation is still blocked** on `ANTHROPIC_API_KEY`, so that third step is untested

## The defect this task's setup exposed

Creating the project surfaced a real bug that local development had masked for months:
**the migrations contain no `GRANT` statements at all.** Every table enables RLS and
defines a full set of policies, but grants are checked *before* row-level security, so
with no DML privileges the policies were never consulted. Production returned
`permission denied for table meditations` on every authenticated page.

It worked locally only because the local database grants `ALL` on these tables to `anon`
and `authenticated` through default privileges, which the hosted project does not. Fixed
by `supabase/migrations/20261001000000_grant_table_privileges.sql`.

Two things worth carrying forward:

- **Local cannot verify grants.** The app works locally whatever the grants say, so an
  under-grant will only ever surface in production. The privilege list in that migration
  was derived by walking every `.from(...)` call site and resolving its client, not by
  testing.
- **`anon` is still deliberately ungranted**, which task 18b must account for — see below.

## Implementation notes
- Use `supabase link --project-ref <ref>` locally, then `supabase db push` to apply migrations.
- Storage bucket: check `supabase/migrations/` for the bucket creation — if it's SQL, it applies with `db push`; if it's a console-only action, document it.
- Do NOT run `supabase/seed.sql` against prod (covered by task 04).
- `service_role` key must only live in Vercel env vars — never in client code.

## Open questions
- ~~Any existing Supabase projects on the work account that collide with naming?~~ Resolved — no collision.
- ~~Is the storage bucket a console-only action?~~ Resolved — it is declarative via `[storage.buckets.*]` in `config.toml`, and the GitHub integration creates it.
- **For task 18b:** `anon` has no `select` on `public.meditations`. The RLS policy already permits rows where `is_public = true`, so unwalling `/discover` in the app is *not* sufficient — without the grant it still returns `permission denied`, because grants precede RLS.

## Plan note
Staying on the **Free** plan (see `docs/superpowers/specs/2026-09-11-go-live-design.md`). Free projects pause after 7 days of low activity and require a *manual* dashboard restore — task 10 adds a daily keepalive cron plus a weekly `pg_dump` to compensate. Revisit Pro ($25/mo) when there is data worth missing.
