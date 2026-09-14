-- Audio was stored as a 1-year signed URL, which both expires and acts as a
-- bearer token that bypasses is_public and RLS. Store the storage path
-- instead and sign short-lived URLs at read time.

alter table public.meditations add column audio_path text;

-- Backfill from existing signed URLs. They look like:
--   {base}/storage/v1/object/sign/meditation-audio/{path}?token=...
-- nullif(...,'') turns a URL ending right at "/meditation-audio/" (empty
-- path) into NULL rather than '', so it falls through to the conventional-path
-- fallback below instead of being left with an unsignable empty string.
update public.meditations
set audio_path = nullif(split_part(split_part(audio_url, '/meditation-audio/', 2), '?', 1), '')
where audio_url is not null
  and audio_url like '%/meditation-audio/%';

-- Any row with audio but no parsable path is a data problem worth seeing.
-- Fall back to the conventional path, which is how uploadAudio names files.
update public.meditations
set audio_path = id::text || '.mp3'
where audio_url is not null and audio_path is null;

comment on column public.meditations.audio_path is
  'Storage path within the meditation-audio bucket. Sign at read time; never store a signed URL here.';

comment on column public.meditations.audio_url is
  'DEPRECATED - retained for rollback only. Read audio_path and sign it instead.';
