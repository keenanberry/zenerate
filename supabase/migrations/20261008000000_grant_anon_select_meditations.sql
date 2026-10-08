-- Let signed-out visitors read public meditations (task 18b).
--
-- public.meditations has carried a "select_own_or_public" policy since it was
-- created -- `auth.uid() = user_id or is_public = true`, applying to every
-- role -- so RLS already permits anon to see public rows and nothing else.
-- For anon, auth.uid() is null, so only the is_public arm can match.
--
-- But grants are checked before RLS, and 20261001000000 deliberately left
-- anon with no SELECT, deferring the decision to this task. Without this
-- grant, unwalling /discover and /meditation/[id] in routing still returns
-- "permission denied for table meditations".
--
-- SELECT on meditations only. The signed-out pages read nothing else through
-- the RLS-bound client: getMeditation and getPublicMeditations skip favorites
-- when there is no user, and audio is signed by the service-role client
-- after the RLS-bound fetch has already decided the row is visible. Every
-- other table stays closed to anon.

-- Same gate as 20261001000000: this grant is only safe behind RLS. With RLS
-- off it would publish every private meditation to the internet.
do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'meditations'
  ) then
    raise exception
      'Refusing to grant anon SELECT: row level security is NOT enabled on '
      'public.meditations. This grant is only safe behind RLS.';
  end if;
end $$;

grant select on public.meditations to anon;
