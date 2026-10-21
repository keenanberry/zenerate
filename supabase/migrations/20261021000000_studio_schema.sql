-- The agentic studio schema (ship task 28).
--
-- Final from day one: the operator seeds the house meditations through the
-- studio as soon as Wave A lands, and those rows are never migrated after.
-- So every column Wave B needs (versions, plays, house picks, search) ships
-- here, even where its UI comes later.
--
-- Shape, decided in tasks/ship/28-studio-schema.md:
--
--   meditations          gains description, tags, draft_script, is_featured
--                        and a search tsvector; prompt becomes nullable. Its
--                        script / audio_path / status / settings keep
--                        describing the CURRENT version, so the audio
--                        workflow and every existing read are unchanged.
--   meditation_versions  ARCHIVED versions only. Owner-only.
--   chats                one per meditation (null = a draft with no script).
--                        Owner-only, always, even on a public meditation.
--   chat_messages        AI SDK UIMessages, parts as jsonb. Owner-only
--                        through chats.
--   meditation_plays     one row per play by a signed-in listener. Insert
--                        own rows only; task 36 adds a security definer
--                        aggregate for Popular.
--
-- Grants follow 20261001000000 and 20261008000000: grants are checked before
-- RLS, so each table gets exactly the privileges the app needs. Supabase's
-- default privileges hand anon and authenticated everything on a new table
-- locally (and on some projects in production), which would make "no anon
-- grant" true only by accident. So each new table first revokes everything
-- from anon and authenticated, then grants back narrowly. Locally and in
-- production the privileges are then the same, and the psql checks in the
-- task prove what production will do.

-- ── meditations ─────────────────────────────────────────────────────────────

-- The studio creates a meditation from a conversation, not a one-line prompt.
alter table public.meditations alter column prompt drop not null;

alter table public.meditations
  add column description text,
  add column tags text[] not null default '{}',
  add column draft_script text,
  add column is_featured boolean not null default false,
  add column search tsvector;

comment on column public.meditations.description is
  'One or two sentences, set by the studio agent (setDetails) and editable by the owner.';
comment on column public.meditations.tags is
  'Tags from the fixed vocabulary in src/lib/meditation/tags.ts.';
comment on column public.meditations.draft_script is
  'A revision made after the current version has audio. A finished render promotes it to script and archives the old version; until then the page shows the old one.';
comment on column public.meditations.is_featured is
  'House pick, set by the operator in SQL. Feeds Popular and Picked for you before real counts exist.';
comment on column public.meditations.search is
  'Full-text search vector over title, tags, description and script. Maintained by meditations_set_search; never write it directly.';

-- A trigger, not a generated column: array_to_string is STABLE (it takes
-- anyarray, whose element output functions need not be immutable), and a
-- generated column only accepts IMMUTABLE expressions. Same workaround as the
-- year_month triggers on the generation ledgers.
--
-- Weights rank a title match above a tag, a tag above the description, and
-- all of them above a word buried in the script. The current script is
-- indexed, not draft_script: search finds what the public page shows.
create or replace function public.meditations_set_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.script, '')), 'D');
  return new;
end;
$$;

create trigger meditations_search_trigger
  before insert or update of title, tags, description, script
  on public.meditations
  for each row execute function public.meditations_set_search();

-- Fill the vector for rows that exist before this migration (the local seed;
-- production is wiped first, but this costs nothing there).
update public.meditations set title = title;

create index idx_meditations_tags on public.meditations using gin (tags);
create index idx_meditations_search on public.meditations using gin (search);
create index idx_meditations_is_featured on public.meditations(is_featured)
  where is_featured = true;

-- ── meditation_versions ─────────────────────────────────────────────────────
--
-- Archived versions only; the current version is the meditations row. Its
-- audio file stays in the meditation-audio bucket at audio_path, and storage
-- does not cascade: whatever deletes a version must delete that object too.

create table public.meditation_versions (
  id uuid primary key default gen_random_uuid(),
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  script text not null,
  audio_path text,
  voice text,
  generation_meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.meditation_versions enable row level security;

-- Owner-only through the parent. The explicit user_id test matters: the
-- meditations select policy also passes public rows, so a bare exists()
-- would let anyone read the archive of a public meditation.
create policy "select_own" on public.meditation_versions
  for select using (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );
create policy "insert_own" on public.meditation_versions
  for insert with check (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );
create policy "delete_own" on public.meditation_versions
  for delete using (
    exists (select 1 from public.meditations m
            where m.id = meditation_id and m.user_id = auth.uid())
  );

create index idx_meditation_versions_meditation
  on public.meditation_versions(meditation_id, created_at desc);

-- ── chats ───────────────────────────────────────────────────────────────────
--
-- One per meditation. Deleting the meditation keeps the conversation
-- (meditation_id goes null) so it can restart the meditation.

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  meditation_id uuid unique references public.meditations(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chats enable row level security;

-- A chat may only point at the caller's own meditation. Without that test a
-- user could attach a chat to someone else's public meditation, and because
-- meditation_id is unique, squat the one chat slot its owner needs.
create policy "select_own" on public.chats
  for select using (auth.uid() = user_id);
create policy "insert_own" on public.chats
  for insert with check (
    auth.uid() = user_id
    and (meditation_id is null or exists (
      select 1 from public.meditations m
      where m.id = meditation_id and m.user_id = auth.uid()))
  );
create policy "update_own" on public.chats
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (meditation_id is null or exists (
      select 1 from public.meditations m
      where m.id = meditation_id and m.user_id = auth.uid()))
  );
create policy "delete_own" on public.chats
  for delete using (auth.uid() = user_id);

-- Recent drafts on /create and the chat list read by owner, newest first.
create index idx_chats_user_updated on public.chats(user_id, updated_at desc);

-- ── chat_messages ───────────────────────────────────────────────────────────
--
-- One row per AI SDK UIMessage, stored as the persistence guide does: the id
-- the server generated, the role, the parts array and optional metadata.
-- created_at defaults to clock_timestamp(), not now(): now() is fixed for the
-- whole transaction, so a turn saved in one insert would give the user and
-- assistant messages the same timestamp and no stable order.

create table public.chat_messages (
  id text primary key,
  chat_id uuid references public.chats(id) on delete cascade not null,
  role text not null check (role in ('system', 'user', 'assistant')),
  parts jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.chat_messages enable row level security;

create policy "select_own" on public.chat_messages
  for select using (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
  );
create policy "insert_own" on public.chat_messages
  for insert with check (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
  );
-- Update so a save can upsert: a message's parts grow as tool results land.
create policy "update_own" on public.chat_messages
  for update using (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
  );
create policy "delete_own" on public.chat_messages
  for delete using (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
  );

create index idx_chat_messages_chat on public.chat_messages(chat_id, created_at);

-- ── meditation_plays ────────────────────────────────────────────────────────
--
-- Signed-in plays only, so there are no public writes. Raw rows are never
-- readable by anon; Popular reads counts through task 36's security definer
-- function.

create table public.meditation_plays (
  id uuid primary key default gen_random_uuid(),
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  played_at timestamptz not null default now()
);

alter table public.meditation_plays enable row level security;

-- Insert own rows, for a meditation the caller can see. The exists() runs
-- under the caller's meditations policy, so that is their own or a public one.
create policy "insert_own" on public.meditation_plays
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.meditations m where m.id = meditation_id)
  );
-- Own history only, for Picked for you.
create policy "select_own" on public.meditation_plays
  for select using (auth.uid() = user_id);

create index idx_meditation_plays_meditation
  on public.meditation_plays(meditation_id, played_at desc);
create index idx_meditation_plays_user
  on public.meditation_plays(user_id, played_at desc);

-- ── Grants ──────────────────────────────────────────────────────────────────

-- Same gate as 20261001000000: the grants below are only safe behind RLS.
do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'meditation_versions', 'chats', 'chat_messages', 'meditation_plays'
    )
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception
      'Refusing to grant DML: row level security is NOT enabled on: %. '
      'These grants are only safe behind RLS.', unprotected;
  end if;
end $$;

-- Start from nothing, whatever the project's default privileges handed out.
revoke all on public.meditation_versions from public, anon, authenticated;
revoke all on public.chats from public, anon, authenticated;
revoke all on public.chat_messages from public, anon, authenticated;
revoke all on public.meditation_plays from public, anon, authenticated;

-- authenticated: versions are written whole and deleted (replace-or-keep),
-- never edited in place. Chats and messages need the full set: titles and
-- updated_at change, and messages are upserted. Plays are append-only.
grant select, insert, delete on public.meditation_versions to authenticated;
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert on public.meditation_plays to authenticated;

-- service_role bypasses RLS by design; see 20261001000000 for why it gets
-- the full set.
grant select, insert, update, delete on public.meditation_versions to service_role;
grant select, insert, update, delete on public.chats to service_role;
grant select, insert, update, delete on public.chat_messages to service_role;
grant select, insert, update, delete on public.meditation_plays to service_role;

-- anon: nothing on any of the four. Chats are private even on a public
-- meditation, archived versions are the owner's, and raw plays would reveal
-- who listened to what. The signed-out pages read only meditations, whose
-- anon SELECT (20261008000000) already covers the new columns.
