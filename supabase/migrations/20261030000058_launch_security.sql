-- Launch security fixes (ship task 58).
--
-- The pre-launch audit found that a signed-in user can write columns the app
-- never meant them to write, and that the spend ceilings count rows the user
-- controls. Grants are checked before RLS and RLS restricts rows, not
-- columns, so the fix is column-level grants plus ledgers only the service
-- role can write. Every app path that writes a column made service-role only
-- below already runs on the service role in the same PR: the generate route
-- (status flip and refunds), the workflow (status, audio_path,
-- generation_meta, versions) and the chat route (chat_messages).
--
-- Deploys on merge, like every migration here. Old code and this migration
-- can briefly overlap in either order; see the PR for why each window is
-- harmless.

-- ── meditations: who may write which column ─────────────────────────────────
--
-- The owner edits what the studio and the details form edit, and nothing
-- else. status, is_featured, audio_path, audio_url, generation_meta and
-- user_id become service-role only: a forged audio_path was how one user
-- could delete another's audio, and a forged status or is_featured how they
-- could promote their own row.
--
-- INSERT is narrowed the same way: writeScript creates a meditation with
-- user_id, title, script, status, is_public and settings, and a row born
-- with a forged audio_path would be the same hole by another door. The
-- insert policy pins what a new row may claim about itself.

revoke insert, update, truncate, references, trigger on public.meditations from authenticated;

grant insert (user_id, title, prompt, description, tags, script, status, is_public, settings)
  on public.meditations to authenticated;
grant update (title, description, tags, script, is_public, settings, updated_at)
  on public.meditations to authenticated;

drop policy "insert_own" on public.meditations;
create policy "insert_own" on public.meditations
  for insert with check (
    auth.uid() = user_id
    and status in ('generating_script', 'script_ready')
    and not is_public
  );

-- is_public stays the owner's to set, but only on a meditation whose audio is
-- made. updateMeditation checks the same thing; this holds for a PATCH made
-- with the owner's JWT straight to PostgREST, which skips the action.
-- Unpublishing is always allowed, and a row that is already public is left
-- alone, so editing its title never trips this.
create function public.meditations_guard_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_public and not old.is_public
     and (new.status <> 'completed' or new.audio_path is null) then
    raise exception 'A meditation can be published only once its audio is made.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.meditations_guard_publish() from public, anon, authenticated;

create trigger meditations_guard_publish_trigger
  before update of is_public on public.meditations
  for each row execute function public.meditations_guard_publish();

-- ── meditations: lengths ────────────────────────────────────────────────────
--
-- The studio's own limits (writeScript's 30,000, setDetails' 80 and 300), now
-- also true of a write that skips the studio. Added NOT VALID and then
-- validated, so a row that somehow broke a limit before today warns rather
-- than failing the deploy; every new write is checked either way.

alter table public.meditations
  add constraint meditations_script_length check (char_length(script) <= 30000) not valid,
  add constraint meditations_title_length check (char_length(title) <= 80) not valid,
  add constraint meditations_description_length check (char_length(description) <= 300) not valid;

-- The owner writes drafts directly too, and the workflow renders them.
alter table public.meditation_drafts
  add constraint meditation_drafts_script_length check (char_length(script) <= 30000) not valid;

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where conname in (
      'meditations_script_length', 'meditations_title_length',
      'meditations_description_length', 'meditation_drafts_script_length'
    )
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      raise warning 'Existing rows break %; it stays NOT VALID and applies to new writes only.', c.conname;
    end;
  end loop;
end $$;

-- ── meditation_versions ─────────────────────────────────────────────────────
--
-- Only the workflow archives a version (service role). An owner-written row
-- could point audio_path anywhere, and deleting the version removes that path.

revoke insert on public.meditation_versions from authenticated;
drop policy "insert_own" on public.meditation_versions;

-- ── chat_messages ───────────────────────────────────────────────────────────
--
-- The chat route saves every message on the service role, after loading the
-- chat through the caller's RLS client proves it is theirs. The owner reads
-- their history and writes none of it: a row they could insert, edit or
-- delete is an assistant turn they could forge, or a turn the old daily
-- ceiling stopped counting. Deleting a whole chat still cascades.

revoke insert, update, delete on public.chat_messages from authenticated;
drop policy "insert_own" on public.chat_messages;
drop policy "update_own" on public.chat_messages;
drop policy "delete_own" on public.chat_messages;

-- ── chat_turns: the daily chat ceiling ──────────────────────────────────────
--
-- One row per model turn, continuations included, reserved before the model
-- runs. Keyed by user, not chat, so deleting a chat refunds nothing.
-- A new table rather than script_generation_events: that ledger counts by
-- calendar month and the chat ceiling is a rolling 24 hours.

create table public.chat_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

comment on table public.chat_turns is
  'One row per studio chat turn, written only by reserve_chat_turn. The per-user and global daily chat ceilings count it.';

alter table public.chat_turns enable row level security;
-- No policies: nothing but the service role (which bypasses RLS) and the
-- security definer function below touches it.

create index idx_chat_turns_user_created on public.chat_turns(user_id, created_at);
create index idx_chat_turns_created on public.chat_turns(created_at);

revoke all on public.chat_turns from public, anon, authenticated;
grant select, insert, delete on public.chat_turns to service_role;

-- Atomic check-and-reserve, shaped like reserve_audio_generation: a global
-- lock so the global count is race-safe across users, a per-user one for
-- the user's count. Returns the turn id or raises 'quota_exceeded' or
-- 'global_cap_reached'.
create function public.reserve_chat_turn(
  p_user_id uuid,
  p_per_user_cap integer,
  p_global_cap integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turn_id uuid;
  v_since timestamptz := now() - interval '24 hours';
begin
  perform pg_advisory_xact_lock(hashtext('chat_turns_global'));
  perform pg_advisory_xact_lock(hashtext('chat_turns:' || p_user_id::text));

  if (select count(*) from public.chat_turns where created_at > v_since) >= p_global_cap then
    raise exception 'global_cap_reached' using errcode = 'P0002';
  end if;

  if (select count(*) from public.chat_turns
      where user_id = p_user_id and created_at > v_since) >= p_per_user_cap then
    raise exception 'quota_exceeded' using errcode = 'P0003';
  end if;

  insert into public.chat_turns (user_id) values (p_user_id)
  returning id into v_turn_id;
  return v_turn_id;
end;
$$;

revoke all on function public.reserve_chat_turn(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_chat_turn(uuid, integer, integer)
  to service_role;

-- ── audio_generation_events: a failed render counts ─────────────────────────
--
-- A failed render used to drop out of both caps and also earn a free retry,
-- so a script built to fail cost nothing. It now counts like a finished one,
-- and the free retry is what makes a genuine failure whole. 'refunded' is the
-- generate route giving back a slot it reserved but never used (a lost
-- compare-and-set, or a workflow that would not start); only that is free.

alter table public.audio_generation_events
  drop constraint audio_generation_events_status_check,
  add constraint audio_generation_events_status_check
    check (status in ('pending', 'completed', 'failed', 'refunded'));

create or replace function public.reserve_audio_generation(
  p_user_id uuid,
  p_meditation_id uuid,
  p_per_user_cap integer,
  p_global_cap integer,
  p_retry_of uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_count integer;
  v_global_count integer;
  v_parent record;
  v_existing_retry uuid;
  v_year_month text := to_char(now(), 'YYYY-MM');
begin
  perform pg_advisory_xact_lock(hashtext('audio_generation_global'));
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if p_retry_of is not null then
    select user_id, meditation_id, status into v_parent
      from public.audio_generation_events
      where id = p_retry_of;

    if not found
       or v_parent.user_id <> p_user_id
       or v_parent.meditation_id <> p_meditation_id
       or v_parent.status <> 'failed' then
      raise exception 'invalid_retry'
        using errcode = 'P0001';
    end if;

    select id into v_existing_retry
      from public.audio_generation_events
      where retry_of = p_retry_of
      limit 1;

    if v_existing_retry is not null then
      raise exception 'invalid_retry'
        using errcode = 'P0001';
    end if;

    insert into public.audio_generation_events
      (user_id, meditation_id, status, is_free_retry, retry_of)
    values
      (p_user_id, p_meditation_id, 'pending', true, p_retry_of)
    returning id into v_event_id;

    return v_event_id;
  end if;

  -- Everything but a refund counts, failed renders included.
  select count(*) into v_global_count
    from public.audio_generation_events
    where year_month = v_year_month
      and is_free_retry = false
      and status <> 'refunded';

  if v_global_count >= p_global_cap then
    raise exception 'global_cap_reached'
      using errcode = 'P0002';
  end if;

  select count(*) into v_user_count
    from public.audio_generation_events
    where user_id = p_user_id
      and year_month = v_year_month
      and is_free_retry = false
      and status <> 'refunded';

  if v_user_count >= p_per_user_cap then
    raise exception 'quota_exceeded'
      using errcode = 'P0003';
  end if;

  insert into public.audio_generation_events
    (user_id, meditation_id, status, is_free_retry)
  values
    (p_user_id, p_meditation_id, 'pending', false)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

-- create or replace keeps the existing grants; restated so this file says
-- who may call it.
revoke all on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid)
  to service_role;

-- ── anon: public columns only ───────────────────────────────────────────────
--
-- anon read every column of a public row: user_id (which groups a person's
-- public meditations), audio_path, generation_meta. Signed-out pages need
-- none of them; the server signs audio with the service role after the
-- public read has shown the row is public (src/lib/audio/signed-url.ts).
-- search is granted so discover_meditations can filter on it as anon.
--
-- The select_own_or_public policy still names user_id; a policy's own
-- column references need no grant.

revoke all on public.meditations from anon;
grant select (id, title, description, tags, script, status, is_public, is_featured,
              settings, created_at, updated_at, search)
  on public.meditations to anon;

-- discover_meditations returned m.*, which anon can no longer read, and which
-- would hand everyone the private columns anyway. It now returns the public
-- columns only. Same body, same filters, same grants as 20261022000036.
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
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.title, m.description, m.tags, m.script, m.status, m.is_public,
         m.is_featured, m.settings, m.created_at, m.updated_at
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

notify pgrst, 'reload schema';
