-- Audio generation events: append-only ledger of every audio generation
-- attempt. Used for per-user monthly quota and global circuit breaker.

create table public.audio_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending','completed','failed')),
  is_free_retry boolean not null default false,
  retry_of uuid references public.audio_generation_events(id),
  year_month text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Populate year_month on insert (to_char is stable, not immutable, so a
-- generated column isn't allowed; a trigger is the standard workaround).
create or replace function public.audio_gen_events_set_year_month()
returns trigger language plpgsql as $$
begin
  new.year_month := to_char(new.created_at, 'YYYY-MM');
  return new;
end;
$$;

create trigger audio_gen_events_year_month_trigger
  before insert on public.audio_generation_events
  for each row execute function public.audio_gen_events_set_year_month();

alter table public.audio_generation_events enable row level security;

-- Users can read their own events (for the UI). Writes happen only via the
-- service-role client from API routes, so no insert/update/delete policies.
create policy "select_own" on public.audio_generation_events
  for select using (auth.uid() = user_id);

create index idx_audio_gen_user_month
  on public.audio_generation_events(user_id, year_month)
  where is_free_retry = false;

create index idx_audio_gen_global_month
  on public.audio_generation_events(year_month)
  where is_free_retry = false;

create index idx_audio_gen_meditation
  on public.audio_generation_events(meditation_id, created_at desc);

-- Atomic check-and-reserve. Caller is the service-role client from the
-- /api/audio/generate route handler. Returns the new event id or raises
-- one of: 'quota_exceeded', 'global_cap_reached', 'invalid_retry'.
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
  -- Two locks: a global one so the global-cap check is race-safe across
  -- different users, plus a per-user lock for tighter serialization on the
  -- per-user count. Both are released at transaction end.
  perform pg_advisory_xact_lock(hashtext('audio_generation_global'));
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if p_retry_of is not null then
    -- Free-retry path: validate parent and ensure no existing retry yet.
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

  -- Normal path: enforce both caps using the same predicate.
  select count(*) into v_global_count
    from public.audio_generation_events
    where year_month = v_year_month
      and is_free_retry = false
      and status in ('pending', 'completed');

  if v_global_count >= p_global_cap then
    raise exception 'global_cap_reached'
      using errcode = 'P0002';
  end if;

  select count(*) into v_user_count
    from public.audio_generation_events
    where user_id = p_user_id
      and year_month = v_year_month
      and is_free_retry = false
      and status in ('pending', 'completed');

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

revoke all on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid) to service_role;
