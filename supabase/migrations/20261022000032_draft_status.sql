-- Task 32: a revision renders without touching the version people can hear.
--
-- A render of draft_script used to flip meditations.status to
-- processing_audio and, on failure, to failed. Both hide the player on a
-- public meditation whose current audio is fine. A draft render now leaves
-- status at completed and tracks itself here instead:
--
--   null          no draft render in flight, or the last one was promoted
--   'processing'  a draft render is running (the trigger route sets it with a
--                 compare-and-set, so two clicks start one run)
--   'failed'      the last draft render failed; the draft and the current
--                 version are untouched, and the free retry applies
--
-- Nullable with no default, so every existing row reads as "no draft render",
-- which is true. The public page never reads it. `if not exists` because the
-- shared local database got this column by hand during the task.

alter table public.meditations
  add column if not exists draft_status text
    check (draft_status in ('processing', 'failed'));

comment on column public.meditations.draft_status is
  'State of a render of draft_script: null, processing or failed. A draft render leaves status at completed so the current version keeps playing.';
