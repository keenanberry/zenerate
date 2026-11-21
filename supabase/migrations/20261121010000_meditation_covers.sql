-- Generated meditation covers, storage and display
-- (docs/superpowers/specs/2026-11-21-generated-cover-art-design.md, PR 1).
--
-- Nothing generates yet: this adds where a cover lives and lets every read
-- that draws a cover carry it. The studio tool that makes covers (PR 2) and
-- the backfill (PR 3) write through the service role only.
--
-- Deploys to production on merge, like every migration here. Additive only:
-- two columns with defaults, a bucket row, a widened anon grant, and the two
-- list functions recreated with one more column. Old code reads the
-- functions' rows by name and ignores the extra column, so the window where
-- old code meets this migration is harmless.

-- ── meditations: the cover and the cap's counter ────────────────────────────
--
-- cover_path is the object's path in the meditation-covers bucket,
-- `<meditation_id>/<random>.<ext>`; null means the designed cover.
-- cover_generations counts the studio tool's generations for its cap of 3.
--
-- Neither is in authenticated's insert or update column grants
-- (20261030000058), and those stay as they are: a direct PostgREST PATCH by
-- the owner can neither point cover_path at another object nor reset the
-- cap. Only the service role writes them.

alter table public.meditations
  add column cover_path text,
  add column cover_generations smallint not null default 0
    constraint meditations_cover_generations_range check (cover_generations between 0 and 3);

comment on column public.meditations.cover_path is
  'Generated cover: object path in the meditation-covers bucket, <meditation_id>/<random>.<ext>. Null shows the designed cover. Service role writes only.';
comment on column public.meditations.cover_generations is
  'How many covers the studio has generated for this meditation (cap 3). Service role writes only; not readable by anon.';

-- ── anon: the public columns, plus cover_path ───────────────────────────────
--
-- Signed-out Discover and meditation pages draw the cover from cover_path. A
-- column grant is additive, so this widens 20261030000058's list by one
-- column; cover_generations stays out.

grant select (cover_path) on public.meditations to anon;

-- ── The bucket ──────────────────────────────────────────────────────────────
--
-- Public: a cover is shown by its public URL
-- (/storage/v1/object/public/meditation-covers/...), which Storage serves
-- without consulting RLS. config.toml buckets exist only locally, so
-- production gets the bucket from this insert; config.toml mirrors it. on
-- conflict do nothing keeps a bucket that already exists as it is.
--
-- Objects are keyed by meditation id, never user id: a public URL that began
-- with the owner's id would let anyone group an author's meditations, which
-- 20261030000058 and 20261120000000 deliberately prevent.
--
-- No storage.objects policies at all: only the service role (which bypasses
-- RLS) uploads, replaces or deletes a cover, after reading the meditation
-- through the owner's RLS-bound client. A forged audio_path once let one user
-- delete another's audio (task 58); with no policy for authenticated there is
-- no such door here. Without a select policy nobody but the service role can
-- list the bucket either, so a private meditation's cover is reachable only
-- by someone already holding its random URL.
--
-- WebP or JPEG as the studio stores them, PNG in case the image provider
-- returns it unconverted; 2 MB is ample for a 1024px square.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meditation-covers', 'meditation-covers', true, 2097152,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ── discover_meditations: with cover_path ───────────────────────────────────
--
-- A function's return type cannot change in place, so it is dropped and
-- created again. Same body, same filters, same grants as 20261030000058,
-- with cover_path added to the return list.

drop function public.discover_meditations(text, text[], text, text, int, int, int);

create function public.discover_meditations(
  q text default null,
  any_tags text[] default null,
  tag text default null,
  meditation_type text default null,
  min_minutes int default null,
  max_minutes int default null,
  row_limit int default 50
)
returns table (
  id uuid,
  title text,
  description text,
  tags text[],
  script text,
  status text,
  is_public boolean,
  is_featured boolean,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  cover_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.title, m.description, m.tags, m.script, m.status, m.is_public,
         m.is_featured, m.settings, m.created_at, m.updated_at, m.cover_path
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
  'Search and filters for /discover over public, completed meditations, public columns only. Security invoker: RLS applies.';

revoke all on function public.discover_meditations(text, text[], text, text, int, int, int)
  from public, anon, authenticated;
grant execute on function public.discover_meditations(text, text[], text, text, int, int, int)
  to anon, authenticated, service_role;

-- ── profile_meditations: with cover_path ────────────────────────────────────
--
-- Same body, same filters, same grants as 20261120000000, with cover_path
-- added to the return list, so a profile's cards draw the same covers as
-- Discover's.

drop function public.profile_meditations(uuid, int);

create function public.profile_meditations(
  p_profile_id uuid,
  row_limit int default 50
)
returns table (
  id uuid,
  title text,
  description text,
  tags text[],
  script text,
  status text,
  is_public boolean,
  is_featured boolean,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  cover_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.description, m.tags, m.script, m.status, m.is_public,
         m.is_featured, m.settings, m.created_at, m.updated_at, m.cover_path
  from public.meditations m
  join public.user_profiles p on p.id = m.user_id
  where m.user_id = p_profile_id
    and (p.is_public or p.id = auth.uid())
    and m.is_public
    and m.status = 'completed'
  order by m.created_at desc
  limit greatest(1, least(coalesce(row_limit, 50), 100));
$$;

comment on function public.profile_meditations is
  'A public profile''s public, completed meditations, newest first. Empty for a private profile unless it is the caller''s own.';

revoke all on function public.profile_meditations(uuid, int) from public, anon, authenticated;
grant execute on function public.profile_meditations(uuid, int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
