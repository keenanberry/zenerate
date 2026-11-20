-- Owner deletion keeps the audio ledger (card ZEN-4).
--
-- audio_generation_events is the ledger the monthly audio caps count
-- (reserve_audio_generation counts rows by user and by month). Its
-- meditation_id was `on delete cascade`, so deleting a meditation deleted
-- the renders it had used and handed the slots back: make audio, delete the
-- meditation, make it again, with no cap at all on the ElevenLabs bill. That
-- was harmless while nothing deleted a meditation but account deletion; the
-- owner delete that ships with this migration makes it reachable.
--
-- So the row outlives its meditation with meditation_id null, the way
-- chats.meditation_id already does. Nothing reads a ledger row by a
-- meditation that no longer exists, and every count is by user_id and
-- year_month, so the null changes no read. A free retry needs its parent's
-- meditation_id to equal the meditation being rendered, which a null never
-- does, so a deleted meditation's failure earns no retry elsewhere.
--
-- Additive for the code on main: it never deletes a meditation through this
-- path before the code in the same PR, and it never writes a null.

alter table public.audio_generation_events
  alter column meditation_id drop not null;

alter table public.audio_generation_events
  drop constraint audio_generation_events_meditation_id_fkey,
  add constraint audio_generation_events_meditation_id_fkey
    foreign key (meditation_id) references public.meditations(id) on delete set null;

comment on column public.audio_generation_events.meditation_id is
  'The meditation rendered; null once it is deleted. The row stays: it is what the monthly caps count.';
