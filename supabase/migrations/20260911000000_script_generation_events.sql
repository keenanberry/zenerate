-- Script generation events: append-only ledger of every Anthropic script
-- generation. Mirrors audio_generation_events but simpler -- scripts are
-- generated before a meditation row exists, so there is no meditation_id,
-- no retry concept, and no status machine.

create table public.script_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year_month text not null,
  created_at timestamptz not null default now()
);

create or replace function public.script_gen_events_set_year_month()
returns trigger language plpgsql as $$
begin
  new.year_month := to_char(new.created_at, 'YYYY-MM');
  return new;
end;
$$;

create trigger script_gen_events_year_month_trigger
  before insert on public.script_generation_events
  for each row execute function public.script_gen_events_set_year_month();

alter table public.script_generation_events enable row level security;

create policy "select_own" on public.script_generation_events
  for select using (auth.uid() = user_id);

create index idx_script_gen_user_month
  on public.script_generation_events(user_id, year_month);

create index idx_script_gen_global_month
  on public.script_generation_events(year_month);

-- Atomic check-and-reserve. Caller is the service-role client from the
-- /api/generate route handler. Returns the new event id or raises one of:
-- 'quota_exceeded', 'global_cap_reached'.
create or replace function public.reserve_script_generation(
  p_user_id uuid,
  p_per_user_cap integer,
  p_global_cap integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_count integer;
  v_global_count integer;
  v_year_month text := to_char(now(), 'YYYY-MM');
begin
  perform pg_advisory_xact_lock(hashtext('script_generation_global'));
  perform pg_advisory_xact_lock(hashtext('script:' || p_user_id::text));

  select count(*) into v_global_count
    from public.script_generation_events
    where year_month = v_year_month;

  if v_global_count >= p_global_cap then
    raise exception 'global_cap_reached' using errcode = 'P0002';
  end if;

  select count(*) into v_user_count
    from public.script_generation_events
    where user_id = p_user_id
      and year_month = v_year_month;

  if v_user_count >= p_per_user_cap then
    raise exception 'quota_exceeded' using errcode = 'P0003';
  end if;

  insert into public.script_generation_events (user_id)
  values (p_user_id)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.reserve_script_generation(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_script_generation(uuid, integer, integer)
  to service_role;
