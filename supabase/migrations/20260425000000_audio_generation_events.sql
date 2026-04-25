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
