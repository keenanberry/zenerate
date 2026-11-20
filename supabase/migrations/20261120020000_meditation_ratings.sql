-- Meditation ratings (card ZEN-5; the design is tasks/post-ship/meditation-ratings.md).
--
-- One 1–5 star rating per listener per meditation. Rating again changes the
-- stars on the same row. A listener reads, writes and removes only their own
-- row, through /api/meditations/[id]/rating. Nobody reads anyone else's:
-- the average and count come from meditation_rating_stats below, which
-- returns aggregates only.
--
-- Who may rate: a signed-in listener, on a public, completed meditation that
-- is not their own. The same exclusions as plays and favorites in
-- popular_meditations: a creator rating their own work is not a signal.
--
-- The rating belongs to the meditation, not a version, so a re-render or a
-- promoted draft keeps it. Both foreign keys cascade: an owner deleting a
-- meditation (ZEN-4) or a person deleting their account takes the ratings
-- with it. Nothing counts these rows toward a cap, so cascading refunds
-- nothing (contrast audio_generation_events, 20261120010000).
--
-- Grants follow 20261120000000: revoke everything from anon and
-- authenticated first, then grant back exactly what the API uses. anon gets
-- nothing on the table. Additive only: a new table, trigger and function.

create table public.meditation_ratings (
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One rating per listener per meditation. Its leading column is
  -- meditation_id, so it is also the index the stats and the cascade use.
  primary key (meditation_id, user_id),
  constraint meditation_ratings_stars_range check (stars between 1 and 5)
);

comment on table public.meditation_ratings is
  'One 1-5 star rating per listener per public meditation. Owner-only rows; meditation_rating_stats exposes the aggregates.';

-- An account deletion cascades by user_id.
create index idx_meditation_ratings_user on public.meditation_ratings(user_id);

alter table public.meditation_ratings enable row level security;

-- The meditation a row points at must be rateable by the caller. Checked on
-- insert and on update, so a rating cannot be written, or changed, once the
-- meditation is private. Removing one's own rating is always allowed.
create policy "select_own" on public.meditation_ratings
  for select using (auth.uid() = user_id);
create policy "insert_own" on public.meditation_ratings
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.meditations m
      where m.id = meditation_id
        and m.is_public
        and m.status = 'completed'
        and m.user_id <> auth.uid())
  );
create policy "update_own" on public.meditation_ratings
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.meditations m
      where m.id = meditation_id
        and m.is_public
        and m.status = 'completed'
        and m.user_id <> auth.uid())
  );
create policy "delete_own" on public.meditation_ratings
  for delete using (auth.uid() = user_id);

-- The database keeps the timestamps, so a write that skips the API cannot
-- backdate a rating: created_at is fixed at insert, updated_at follows every
-- change.
create function public.meditation_ratings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.meditation_ratings_touch() from public, anon, authenticated;

create trigger meditation_ratings_touch_trigger
  before insert or update on public.meditation_ratings
  for each row execute function public.meditation_ratings_touch();

-- Insert names the row and its stars; update changes the stars only, so a
-- rating cannot be moved to another meditation or person. The API therefore
-- updates and then inserts rather than upserting: PostgREST's upsert would
-- rewrite the key columns too.
revoke all on public.meditation_ratings from anon, authenticated;
grant select (meditation_id, user_id, stars, created_at, updated_at)
  on public.meditation_ratings to authenticated;
grant insert (meditation_id, user_id, stars) on public.meditation_ratings to authenticated;
grant update (stars) on public.meditation_ratings to authenticated;
grant delete on public.meditation_ratings to authenticated;
grant select, insert, update, delete on public.meditation_ratings to service_role;

-- ── Average and count ───────────────────────────────────────────────────────
--
-- Batched, in the shape of meditation_authors, so a Discover row costs one
-- call. SECURITY DEFINER because nobody can read another listener's rows; it
-- returns aggregates only, and only for public, completed meditations. A
-- meditation with no ratings, or not public, is simply left out. The owner's
-- own rows are excluded as in popular_meditations, though the policies never
-- let one in. At most 100 ids are looked at.
--
-- average is rounded to one decimal for display. Ranking (a Bayesian
-- average, per the task file) is a later slice and can add a sum here.

create function public.meditation_rating_stats(p_meditation_ids uuid[])
returns table (
  meditation_id uuid,
  average numeric,
  count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, round(avg(r.stars), 1), count(*)
  from public.meditations m
  join public.meditation_ratings r on r.meditation_id = m.id
  where m.id = any (p_meditation_ids[1:100])
    and m.is_public
    and m.status = 'completed'
    and r.user_id <> m.user_id
  group by m.id;
$$;

comment on function public.meditation_rating_stats is
  'Average stars (one decimal) and rating count per public, completed meditation given; unrated ones are omitted. Security definer: aggregates only.';

revoke all on function public.meditation_rating_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.meditation_rating_stats(uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
