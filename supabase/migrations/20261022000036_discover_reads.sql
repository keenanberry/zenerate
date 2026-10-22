-- Discover reads (ship task 36).
--
-- Additive only: two new functions and their grants. No table, column, row
-- or existing privilege changes, so it is safe to reach production while the
-- operator is seeding real meditations.
--
--   discover_meditations   search and filters for /discover. SECURITY
--                          INVOKER, so the meditations RLS policy still
--                          decides what a caller sees; the is_public test
--                          below is the page's rule, not the security.
--   popular_meditations    favorites plus signed-in plays per public
--                          meditation. SECURITY DEFINER, because neither
--                          favorites nor meditation_plays is readable by
--                          anon (or by anyone but the row's owner). It
--                          returns counts only, and only for public,
--                          completed meditations.
--
-- Grants: Postgres gives EXECUTE on a new function to PUBLIC, and Supabase's
-- default privileges add anon and authenticated locally (and on some
-- projects in production). As in 20261021000000, each function starts from
-- nothing and grants back exactly who calls it, so the psql check in the task
-- proves what production will do. Signed-out /discover calls both, so anon
-- needs both.

-- ── discover_meditations ────────────────────────────────────────────────────
--
-- Every filter is optional; null means "any". Ranked by ts_rank when there is
-- a query (title over tags over description over script, per the weights in
-- meditations_set_search), newest first otherwise.
--
--   q              websearch syntax: words, "quoted phrases", -excluded
--   any_tags       a category: the meditation has at least one of these
--   tag            a single tag the meditation must have
--   meditation_type settings.type
--   min_minutes,   settings.duration (whole minutes), inclusive
--   max_minutes
--
-- settings is free-form jsonb, so the duration is cast only when it is a
-- plain integer; anything else simply fails a duration filter.

create or replace function public.discover_meditations(
  q text default null,
  any_tags text[] default null,
  tag text default null,
  meditation_type text default null,
  min_minutes int default null,
  max_minutes int default null,
  row_limit int default 50
)
returns setof public.meditations
language sql
stable
security invoker
set search_path = ''
as $$
  select m.*
  from public.meditations m
  cross join (
    select case when nullif(btrim(q), '') is not null
      then websearch_to_tsquery('english', q)
    end as query
  ) p
  cross join lateral (
    select case when m.settings->>'duration' ~ '^[0-9]+$'
      then (m.settings->>'duration')::int
    end as minutes
  ) d
  where m.is_public
    and m.status = 'completed'
    and (p.query is null or m.search @@ p.query)
    and (any_tags is null or cardinality(any_tags) = 0 or m.tags && any_tags)
    and (tag is null or m.tags @> array[tag])
    and (meditation_type is null or m.settings->>'type' = meditation_type)
    and (min_minutes is null or d.minutes >= min_minutes)
    and (max_minutes is null or d.minutes <= max_minutes)
  order by
    case when p.query is not null then ts_rank(m.search, p.query) end desc nulls last,
    m.created_at desc
  limit greatest(1, least(coalesce(row_limit, 50), 100));
$$;

comment on function public.discover_meditations is
  'Search and filters for /discover over public, completed meditations. Security invoker: RLS applies.';

-- ── popular_meditations ─────────────────────────────────────────────────────
--
-- score = favorites + plays. A play row exists only once a signed-in listener
-- passed 30 seconds (the player decides; see src/components/use-play-tracking.ts),
-- so every row counts. The owner's own favorites and plays are left out: a
-- creator replaying their meditation is not popularity.
--
-- Meditations with no score are omitted. The app decides how much score is
-- "meaningful" and pads the row with is_featured house picks below that.

create or replace function public.popular_meditations(row_limit int default 12)
returns table (meditation_id uuid, favorites bigint, plays bigint, score bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, f.n, p.n, f.n + p.n
  from public.meditations m
  cross join lateral (
    select count(*) as n from public.favorites x
    where x.meditation_id = m.id and x.user_id <> m.user_id
  ) f
  cross join lateral (
    select count(*) as n from public.meditation_plays x
    where x.meditation_id = m.id and x.user_id <> m.user_id
  ) p
  where m.is_public
    and m.status = 'completed'
    and f.n + p.n > 0
  order by f.n + p.n desc, m.created_at desc
  limit greatest(1, least(coalesce(row_limit, 12), 50));
$$;

comment on function public.popular_meditations is
  'Favorites plus signed-in plays per public, completed meditation, owner excluded. Security definer: returns counts only.';

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.discover_meditations(text, text[], text, text, int, int, int)
  from public, anon, authenticated;
revoke all on function public.popular_meditations(int)
  from public, anon, authenticated;

grant execute on function public.discover_meditations(text, text[], text, text, int, int, int)
  to anon, authenticated, service_role;
grant execute on function public.popular_meditations(int)
  to anon, authenticated, service_role;
