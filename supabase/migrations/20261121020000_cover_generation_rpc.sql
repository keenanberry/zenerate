-- The studio's cover cap: reserve and release a generation
-- (docs/superpowers/specs/2026-11-21-generated-cover-art-design.md, PR 2).
--
-- makeCover reserves one of a meditation's 3 generations before it calls the
-- image model, and releases it if the generation or the upload fails, so a
-- failure never counts against the cap. The reserve is one conditional
-- UPDATE: a second caller blocks on the first's row lock, then re-checks
-- `cover_generations < 3` against the committed value, so two calls at 2/3
-- can never both pass.
--
-- Deploys to production on merge. Additive only: two new functions, nothing
-- dropped or altered. Execute goes to service_role alone; cover_generations
-- stays out of authenticated's update grant (20261121010000), so an owner can
-- neither reset the cap nor spend it from the browser. The tool proves
-- ownership through the owner's RLS-bound client before it calls these.

-- The new count (1 to 3), or null when the meditation is at the cap or does
-- not exist.
create or replace function public.reserve_cover_generation(p_meditation uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.meditations
     set cover_generations = cover_generations + 1
   where id = p_meditation
     and cover_generations < 3
  returning cover_generations;
$$;

-- Give back a reserved generation after a failure. Never below 0.
create or replace function public.release_cover_generation(p_meditation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.meditations
     set cover_generations = greatest(cover_generations - 1, 0)
   where id = p_meditation;
$$;

revoke all on function public.reserve_cover_generation(uuid) from public, anon, authenticated;
revoke all on function public.release_cover_generation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_cover_generation(uuid) to service_role;
grant execute on function public.release_cover_generation(uuid) to service_role;
