-- Drafts owner-only, step 2 of 2 (ship task 38b).
--
-- Step 1 (20261023000038) created the owner-only meditation_drafts, copied
-- the drafts into it and mirrored every later write. This ships with the
-- code that reads and writes only that table, so the old columns go, and with
-- them the last way for anon to read a draft: REST on meditations, and
-- discover_meditations' m.*.
--
-- Migrations apply on merge and Vercel deploys alongside, in no set order:
--
--   new code first   it never touches the old columns, which stop changing.
--                    It may promote a draft (deleting its table row) while
--                    meditations.draft_script still holds the same text.
--   migration first  the old code briefly reads columns that are gone; see
--                    the PR for why that window is harmless.

-- ── Re-copy anything the mirror missed ──────────────────────────────────────
--
-- The mirror trigger kept the table exact, so this should insert nothing. It
-- is the belt to that brace: a draft on the old columns with no table row is
-- copied, unless its text is already the meditation's script, which is a
-- draft the new code has promoted. It never overwrites a table row, since
-- the new code may have written that row after the mirror stopped.

insert into public.meditation_drafts (meditation_id, script, render_status, updated_at)
select id, draft_script, draft_status, updated_at
from public.meditations
where draft_script is not null
  and draft_script is distinct from script
on conflict (meditation_id) do nothing;

-- ── Drop the mirror and the columns ─────────────────────────────────────────

drop trigger meditations_mirror_draft_trigger on public.meditations;
drop function public.meditations_mirror_draft();

-- The draft_status check constraint goes with its column.
alter table public.meditations
  drop column draft_script,
  drop column draft_status;

-- discover_meditations returns setof meditations and selects m.*, so it now
-- returns the row without either column; it needs no change.

notify pgrst, 'reload schema';
