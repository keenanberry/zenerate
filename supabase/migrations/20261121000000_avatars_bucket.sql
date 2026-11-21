-- Profile photos (docs/superpowers/specs/2026-11-21-avatar-upload-design.md).
--
-- The browser centre-crops a picked photo to a 512px WebP square and uploads
-- it with the person's own session to avatars/<user id>/<random>.webp, then
-- saves the object's public URL as user_profiles.avatar_url through
-- PATCH /api/profile, then deletes the photo it replaced.
--
-- The bucket is public: an avatar is shown by its public URL
-- (/storage/v1/object/public/avatars/...), which Storage serves without
-- consulting RLS. config.toml buckets exist only locally, so production gets
-- the bucket from this insert; config.toml mirrors it. on conflict do nothing
-- keeps a bucket that already exists (local, from config.toml) as it is.
--
-- Bucket limits are enforced by Storage on every upload: WebP only, 1 MB.
--
-- Policies, all for authenticated and all scoped to this bucket, so they
-- grant nothing anywhere else:
--   * insert, update, delete: only directly inside the caller's own folder
--     (the first path segment is auth.uid(), and there is no second folder).
--     A nested path would be one the app never writes and never cleans up.
--   * select: the same rule. Storage's API reads the row back on a delete
--     and an upsert, so the owner needs it. There is deliberately no select
--     for anon or for other users: that would let anyone list the bucket and
--     find the photo of a person whose profile is private. Showing a photo
--     needs no select, because public URLs bypass RLS.
-- Update is granted for parity with an upsert; the app always writes a new
-- random path, so it never overwrites in place (no stale cached photo).
--
-- Additive only: a bucket row and four policies on storage.objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy "avatars: owner reads own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "avatars: owner uploads to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "avatars: owner updates own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "avatars: owner deletes own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );
