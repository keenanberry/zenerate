-- User profiles (card ZEN-2).
--
-- One row per account, 1:1 with auth.users, holding what a person says about
-- themselves: a display name, an avatar URL and a short bio. The owner reads
-- and edits theirs through /api/profile.
--
-- Profiles are private until the owner opts in (is_public). A public profile
-- is readable by anyone, signed out included, and is what links a person to
-- their public meditations: /api/profiles/[id] lists them, and
-- meditation_authors names the author of a public meditation. Task 58 took
-- meditations.user_id away from anon so that nobody could group a person's
-- public meditations; that stays true for everyone who has not opted in.
-- Both functions below join through a public profile, and user_id itself is
-- still not granted.
--
-- Profile ids are user ids, so a later follows(follower_id, followee_id)
-- table can reference this one directly.
--
-- Grants follow 20261021000000: revoke everything from anon and
-- authenticated first, because Supabase's default privileges would otherwise
-- hand them the table, then grant back exactly what the app needs. The owner
-- may update the profile columns and nothing else; id and created_at are
-- fixed, and only the trigger below inserts.

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The same limits as src/lib/profile/profile.ts, true of a write that
  -- skips the API and goes to PostgREST with the owner's JWT.
  constraint user_profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 50),
  constraint user_profiles_bio_length
    check (bio is null or char_length(bio) <= 300),
  constraint user_profiles_avatar_url_https
    check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048))
);

comment on table public.user_profiles is
  'One profile per account. Created by on_auth_user_created_profile; the owner edits it through /api/profile.';
comment on column public.user_profiles.is_public is
  'Opt-in. When true, anyone may read the public columns and see this person as the author of their public meditations.';

alter table public.user_profiles enable row level security;

create policy "select_own" on public.user_profiles
  for select using (auth.uid() = id);
create policy "select_public" on public.user_profiles
  for select using (is_public);
create policy "update_own" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.user_profiles from anon, authenticated;
-- What a public profile shows signed out. Column grants cannot vary by row,
-- so a signed-in caller can also read updated_at of a profile RLS shows them
-- (their own, or a public one); /api/profiles/[id] selects the anon columns.
grant select (id, display_name, avatar_url, bio, is_public, created_at)
  on public.user_profiles to anon;
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url, bio, is_public, updated_at)
  on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

-- Every new account gets an empty, private profile, so reads and updates
-- never have to create one. SECURITY DEFINER because it runs as the auth
-- service, which has no grant on this table. It must never fail a signup:
-- the insert is idempotent and touches nothing the new user could supply.
create function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_user_profile();

-- Accounts that exist before this migration.
insert into public.user_profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ── A person's public meditations ───────────────────────────────────────────
--
-- SECURITY DEFINER because it filters on meditations.user_id, which anon may
-- not read. It returns nothing unless the profile is public (or is the
-- caller's own, so an owner can preview their page before opting in), and
-- only public, completed meditations, in discover_meditations' columns so
-- the same cards render them.

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
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.description, m.tags, m.script, m.status, m.is_public,
         m.is_featured, m.settings, m.created_at, m.updated_at
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

-- ── Who made a meditation ───────────────────────────────────────────────────
--
-- The author line for meditation cards and pages, batched so a Discover row
-- costs one call. A meditation whose author has not opted in is simply left
-- out, so a caller cannot tell "private author" from "no such meditation".
-- At most 100 ids are looked at.

create function public.meditation_authors(p_meditation_ids uuid[])
returns table (
  meditation_id uuid,
  author_id uuid,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, p.id, p.display_name, p.avatar_url
  from public.meditations m
  join public.user_profiles p on p.id = m.user_id
  where m.id = any (p_meditation_ids[1:100])
    and m.is_public
    and p.is_public;
$$;

comment on function public.meditation_authors is
  'The public author of each public meditation given, for those whose author has a public profile.';

revoke all on function public.meditation_authors(uuid[]) from public, anon, authenticated;
grant execute on function public.meditation_authors(uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
