-- Drafts owner-only, step 1 of 2 (ship task 38b).
--
-- A revision in progress lives on the meditation row as draft_script and
-- draft_status. anon may SELECT meditations (20261008000000), so on a public
-- meditation anyone with the public key can read the draft over REST, and
-- discover_meditations returns it with m.*. Column grants are no fix: they
-- break every anon select *, discover_meditations included.
--
-- So drafts move to their own table, owner-only like meditation_versions
-- and with no anon grant at all.
--
-- Additive only, because migrations deploy on merge while the code on main
-- still reads and writes the old columns:
--
--   1. create meditation_drafts with RLS and grants
--   2. copy the drafts that exist now
--   3. mirror every later write to the old columns into the new table, so
--      the table stays exact for as long as the old code runs
--
-- Step 2 (20261024000038) ships with the code that reads the table: it
-- drops the mirror trigger and the two columns. Until then nothing reads
-- meditation_drafts, so this migration changes no behavior.

-- ── meditation_drafts ───────────────────────────────────────────────────────
--
-- One row per meditation with a revision waiting for a render. No row means
-- no draft. Deleting the meditation deletes its draft.
--
--   script         the revision; a finished render promotes it to
--                  meditations.script and deletes this row
--   render_status  null          no render of this draft is in flight
--                  'processing'  a render is running (the trigger route sets
--                                it with a compare-and-set)
--                  'failed'      the last render failed; the free retry applies

create table public.meditation_drafts (
  meditation_id uuid primary key references public.meditations(id) on delete cascade,
  script text not null,
  render_status text check (render_status in ('processing', 'failed')),
  updated_at timestamptz not null default now()
);

comment on table public.meditation_drafts is
  'A revision made after the current version has audio, and the state of its render. Owner-only: never readable by anon, even on a public meditation.';

alter table public.meditation_drafts enable row level security;

-- Owner-only through the parent. The explicit user_id test matters: the
-- meditations select policy also passes public rows, so a bare exists()
-- would let anyone read the draft of a public meditation.
create policy "select_own" on public.meditation_drafts
  for select using (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );
create policy "insert_own" on public.meditation_drafts
  for insert with check (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );
create policy "update_own" on public.meditation_drafts
  for update using (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );
create policy "delete_own" on public.meditation_drafts
  for delete using (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
--
-- As in 20261021000000: start from nothing, whatever the project's default
-- privileges handed out, then grant back exactly what the app needs. The
-- owner writes drafts (writeScript) and flips render_status (the trigger
-- route); the workflow promotes and fails them as service_role.

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.meditation_drafts'::regclass) then
    raise exception 'Refusing to grant DML: row level security is NOT enabled on meditation_drafts.';
  end if;
end $$;

revoke all on public.meditation_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.meditation_drafts to authenticated;
grant select, insert, update, delete on public.meditation_drafts to service_role;
-- anon: nothing.

-- ── Copy the drafts that exist now ──────────────────────────────────────────
--
-- draft_status is only ever set while draft_script is, so a row with no
-- draft_script has nothing to copy.

insert into public.meditation_drafts (meditation_id, script, render_status, updated_at)
select id, draft_script, draft_status, updated_at
from public.meditations
where draft_script is not null
on conflict (meditation_id) do nothing;

-- ── Mirror the old columns until step 2 ─────────────────────────────────────
--
-- The code on main keeps writing draft_script and draft_status until step 2
-- deploys. Each of those writes lands here too, in the same transaction, so
-- step 2 can drop the columns without re-copying anything: the table is
-- already exact. A null draft_script is a promoted (or absent) draft, so the
-- row goes.
--
-- Security definer so the mirror never depends on who wrote the meditation
-- (the owner's session or service_role); it only ever touches the row of the
-- meditation being written.

create function public.meditations_mirror_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.draft_script is null then
    delete from public.meditation_drafts where meditation_id = new.id;
  else
    insert into public.meditation_drafts (meditation_id, script, render_status, updated_at)
    values (new.id, new.draft_script, new.draft_status, now())
    on conflict (meditation_id) do update
      set script = excluded.script,
          render_status = excluded.render_status,
          updated_at = excluded.updated_at;
  end if;
  return null;
end;
$$;

revoke all on function public.meditations_mirror_draft() from public, anon, authenticated;

create trigger meditations_mirror_draft_trigger
  after insert or update of draft_script, draft_status
  on public.meditations
  for each row execute function public.meditations_mirror_draft();
