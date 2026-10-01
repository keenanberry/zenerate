-- Grant the DML privileges the application actually needs.
--
-- WHY THIS EXISTS
--
-- Every table in this schema was created with RLS enabled and a full set of
-- policies, but with no GRANT statements. That worked locally, where the
-- tables inherited default privileges, and failed in production: the first
-- query the dashboard made returned
--
--   Error: permission denied for table meditations
--
-- information_schema.role_table_grants showed `anon` and `authenticated`
-- holding only REFERENCES, TRIGGER and TRUNCATE on every table -- none of
-- SELECT, INSERT, UPDATE or DELETE. Grants are checked BEFORE row-level
-- security, so the policies were never consulted at all. A complete and
-- correct set of RLS policies is worth nothing if the role cannot reach the
-- table to have them applied.
--
-- WHY THIS IS SAFE
--
-- RLS is enabled on all six tables and stays enabled. These grants open the
-- table; the policies still decide the rows. `authenticated` gets exactly the
-- operations the application performs through the RLS-bound client
-- (src/lib/supabase/server.ts), and every one of them already has a matching
-- policy restricting it to the caller's own rows -- or, for meditations,
-- their own rows plus rows marked is_public.
--
-- Granting more than the app uses would be privilege the policies then have
-- to defend against, so the lists below are deliberately narrow: no UPDATE on
-- collection_items or favorites, because nothing updates them in place -- they
-- are inserted and deleted.

-- ── Safety gate ─────────────────────────────────────────────────────────────
--
-- Everything below is only safe BECAUSE row level security is on. If RLS were
-- off on any of these tables, these grants would hand every signed-in user
-- full read and write access to every other user's rows -- turning a broken
-- app into a data breach.
--
-- All six tables enable RLS in their creating migrations, so this should never
-- fire. It exists because "should never fire" is exactly the assumption worth
-- enforcing in the one migration whose correctness depends on it: a future
-- `alter table ... disable row level security`, or a table recreated without
-- it, would otherwise silently widen these grants. Fail the migration loudly
-- instead.

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'meditations', 'collections', 'collection_items',
      'favorites', 'audio_generation_events', 'script_generation_events'
    )
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception
      'Refusing to grant DML: row level security is NOT enabled on: %. '
      'These grants are only safe behind RLS.', unprotected;
  end if;
end $$;

-- ── authenticated ───────────────────────────────────────────────────────────
-- Scoped to what src/lib/meditation/actions.ts actually calls.

grant select, insert, update, delete on public.meditations to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, delete on public.collection_items to authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- Read-only. The ledgers are written exclusively by the reserve_* functions,
-- which are SECURITY DEFINER and so run as their owner rather than the caller.
-- Users only ever read their own rows, to render remaining quota -- which is
-- precisely what the existing "select_own" policies on both tables allow.
-- audio_generation_events is read today by getQuotaUsage via the RLS-bound
-- client; script_generation_events is not read yet, but its policy exists for
-- the same purpose and granting it now avoids a second migration when the
-- script quota surfaces in the UI.
grant select on public.audio_generation_events to authenticated;
grant select on public.script_generation_events to authenticated;

-- ── service_role ────────────────────────────────────────────────────────────
-- The trusted server-side identity. Its key never leaves the server
-- (src/lib/supabase/service-role.ts) and it bypasses RLS by design, so
-- narrowing these grants would buy no safety and would break server code
-- later. /api/cron/keepalive reads meditations through this role, so without
-- at least SELECT here the daily keepalive would fail the moment it first ran
-- -- silently, and exactly when nobody is looking.

grant select, insert, update, delete on public.meditations to service_role;
grant select, insert, update, delete on public.collections to service_role;
grant select, insert, update, delete on public.collection_items to service_role;
grant select, insert, update, delete on public.favorites to service_role;
grant select, insert, update, delete on public.audio_generation_events to service_role;
grant select, insert, update, delete on public.script_generation_events to service_role;

-- ── anon: deliberately NOT granted ──────────────────────────────────────────
--
-- public.meditations already has a policy permitting anyone to read rows where
-- is_public = true, so a single `grant select on public.meditations to anon`
-- would make public meditations readable signed-out.
--
-- That is task 18b's decision, not this migration's. This migration restores
-- an app that is broken in production; it should not quietly widen who can
-- read anything. When 18b lands it needs this grant as well as the
-- (app)/layout.tsx redirect change -- without it, unwalling /discover still
-- returns "permission denied", because the grant check precedes RLS.
