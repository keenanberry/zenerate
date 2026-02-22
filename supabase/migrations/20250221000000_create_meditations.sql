-- 1. Meditations (core content)
create table public.meditations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  prompt text not null,
  script text,
  status text not null default 'generating_script'
    check (status in ('generating_script','script_ready','processing_audio','completed','failed')),
  is_public boolean not null default false,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.meditations enable row level security;

create policy "select_own_or_public" on public.meditations
  for select using (auth.uid() = user_id or is_public = true);
create policy "insert_own" on public.meditations
  for insert with check (auth.uid() = user_id);
create policy "update_own" on public.meditations
  for update using (auth.uid() = user_id);
create policy "delete_own" on public.meditations
  for delete using (auth.uid() = user_id);

create index idx_meditations_user_id on public.meditations(user_id);
create index idx_meditations_is_public on public.meditations(is_public) where is_public = true;

-- 2. Collections (user-created playlists/groups)
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.collections enable row level security;

create policy "select_own" on public.collections for select using (auth.uid() = user_id);
create policy "insert_own" on public.collections for insert with check (auth.uid() = user_id);
create policy "update_own" on public.collections for update using (auth.uid() = user_id);
create policy "delete_own" on public.collections for delete using (auth.uid() = user_id);

create index idx_collections_user_id on public.collections(user_id);

-- 3. Collection items (join table)
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.collections(id) on delete cascade not null,
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  position integer not null default 0,
  added_at timestamptz default now(),
  unique(collection_id, meditation_id)
);

alter table public.collection_items enable row level security;

create policy "select_own" on public.collection_items
  for select using (
    exists (select 1 from public.collections where id = collection_id and user_id = auth.uid())
  );
create policy "insert_own" on public.collection_items
  for insert with check (
    exists (select 1 from public.collections where id = collection_id and user_id = auth.uid())
  );
create policy "delete_own" on public.collection_items
  for delete using (
    exists (select 1 from public.collections where id = collection_id and user_id = auth.uid())
  );

create index idx_collection_items_collection_id on public.collection_items(collection_id);

-- 4. Favorites (quick-save any meditation)
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, meditation_id)
);

alter table public.favorites enable row level security;

create policy "select_own" on public.favorites for select using (auth.uid() = user_id);
create policy "insert_own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "delete_own" on public.favorites for delete using (auth.uid() = user_id);

create index idx_favorites_user_id on public.favorites(user_id);
create index idx_favorites_meditation_id on public.favorites(meditation_id);
