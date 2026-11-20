-- Meditation bookmarks (card ZEN-7; the design is tasks/post-ship/bookmarks.md).
--
-- "Save for later": a listener keeps a public meditation to come back to.
-- Not favorites. A favorite is a heart that says "I liked this": it has its
-- own dashboard tab, feeds Picked for you, and counts toward Popular. A
-- bookmark is private intent, counts toward nothing, and lists newest first
-- through GET /api/bookmarks.
--
-- Who may bookmark: a signed-in listener, on a public, completed meditation.
-- The owner may bookmark their own, as favorites allow (favorites' insert
-- policy does not exclude the owner; only ratings do, because a rating is a
-- signal and a bookmark is not). A listener reads, adds and removes only
-- their own rows. Removing is always allowed, so a bookmark on a meditation
-- that has since gone private can still be taken back; the list hides it.
--
-- Both foreign keys cascade: an owner deleting a meditation (ZEN-4) or a
-- person deleting their account takes the bookmarks with it. Nothing counts
-- these rows toward a cap, so cascading refunds nothing (contrast
-- audio_generation_events, 20261120010000).
--
-- Grants follow 20261120020000: revoke everything from anon and
-- authenticated first, then grant back exactly what the API uses. created_at
-- is not insertable, so a write that skips the API cannot backdate one, and
-- nothing is updatable: a bookmark is added or removed, never changed.
-- Additive only: a new table, its indexes and policies.

create table public.meditation_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- One bookmark per listener per meditation. Its leading column is user_id,
  -- so it is also the index the "is this bookmarked" batch lookup and an
  -- account deletion use.
  primary key (user_id, meditation_id)
);

comment on table public.meditation_bookmarks is
  'Save for later: one row per listener per public meditation they bookmarked. Owner-only rows; counts toward nothing.';

-- The list, newest first, read a page at a time.
create index idx_meditation_bookmarks_user_created
  on public.meditation_bookmarks(user_id, created_at desc, meditation_id desc);

-- A meditation deletion cascades by meditation_id.
create index idx_meditation_bookmarks_meditation on public.meditation_bookmarks(meditation_id);

alter table public.meditation_bookmarks enable row level security;

create policy "select_own" on public.meditation_bookmarks
  for select using (auth.uid() = user_id);
create policy "insert_own" on public.meditation_bookmarks
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.meditations m
      where m.id = meditation_id
        and m.is_public
        and m.status = 'completed')
  );
-- No meditation condition: a bookmark can be removed whatever became of it.
create policy "delete_own" on public.meditation_bookmarks
  for delete using (auth.uid() = user_id);

revoke all on public.meditation_bookmarks from anon, authenticated;
grant select (user_id, meditation_id, created_at) on public.meditation_bookmarks to authenticated;
grant insert (user_id, meditation_id) on public.meditation_bookmarks to authenticated;
grant delete on public.meditation_bookmarks to authenticated;
grant select, insert, update, delete on public.meditation_bookmarks to service_role;

notify pgrst, 'reload schema';
