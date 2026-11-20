-- User profiles (card ZEN-2).
--
-- One row per account, 1:1 with auth.users, holding what a person says about
-- themselves: a display name, an avatar URL and a short bio. This migration
-- ships the record and the owner's own read and write only
-- (GET/PATCH /api/profile). Public profiles, the author line on Discover,
-- avatar uploads and account deletion are later work
-- (tasks/post-ship/user-profiles.md); so there is no anon grant and no
-- public-read policy yet.
--
-- Grants follow 20261021000000: revoke everything from anon and
-- authenticated first, because Supabase's default privileges would otherwise
-- hand them the table, then grant back exactly what the app needs. The owner
-- may update the three profile columns and nothing else; id and created_at
-- are fixed, and only the trigger below inserts.

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
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
  'One profile per account. Created by on_auth_user_created_profile; the owner reads and edits it through /api/profile.';

alter table public.user_profiles enable row level security;

create policy "select_own" on public.user_profiles
  for select using (auth.uid() = id);
create policy "update_own" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url, bio, updated_at)
  on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

-- Every new account gets an empty profile, so reads and updates never have to
-- create one. SECURITY DEFINER because it runs as the auth service, which has
-- no grant on this table. It must never fail a signup: the insert is
-- idempotent and touches nothing the new user could supply.
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
