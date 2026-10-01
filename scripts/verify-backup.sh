#!/usr/bin/env bash
#
# Restore a pg_dump into a throwaway local database and report what landed.
#
# "An untested backup is not a backup" is only actionable if testing one is
# cheap, so this is a single command. It never touches production and never
# touches the local Supabase stack -- it creates its own scratch database,
# uses it, and drops it again.
#
# Usage:  ./scripts/verify-backup.sh <dump.sql> [postgres-url]
#
# The optional second argument is a superuser connection to a local Postgres
# (default: the one bundled with `supabase start`). Nothing here accepts a
# production URL by design: this script creates and drops databases.

set -euo pipefail

DUMP="${1:-}"
ADMIN_URL="${2:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SCRATCH="zenerate_restore_check_$$"

if [[ -z "$DUMP" ]]; then
  echo "usage: $0 <dump.sql> [postgres-url]" >&2
  exit 64
fi

if [[ ! -r "$DUMP" ]]; then
  echo "error: cannot read dump file: $DUMP" >&2
  exit 66
fi

# Refuse anything that looks like a hosted database. This script drops
# databases; pointing it at production would be unrecoverable.
if [[ "$ADMIN_URL" == *"supabase.co"* || "$ADMIN_URL" == *"supabase.com"* ]]; then
  echo "error: refusing to run against a hosted Supabase URL." >&2
  echo "       This script CREATEs and DROPs databases. Use a local Postgres." >&2
  exit 77
fi

for bin in psql pg_dump; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: $bin not found in PATH" >&2; exit 69; }
done

if ! psql "$ADMIN_URL" -c 'select 1' >/dev/null 2>&1; then
  echo "error: cannot reach Postgres at $ADMIN_URL" >&2
  echo "       Is the local stack running? Try: supabase start" >&2
  exit 69
fi

cleanup() {
  psql "$ADMIN_URL" -q -c "drop database if exists \"$SCRATCH\" with (force)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

BASE_URL="${ADMIN_URL%/*}"
SCRATCH_URL="$BASE_URL/$SCRATCH"

echo "==> Creating scratch database $SCRATCH"
psql "$ADMIN_URL" -q -c "create database \"$SCRATCH\""

# The dump references Supabase-managed roles that do not exist locally. Create
# them as no-login stubs so ownership/grant statements resolve instead of
# aborting the restore. They are dropped with the database.
echo "==> Stubbing Supabase roles"
psql "$SCRATCH_URL" -q <<'SQL'
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','supabase_auth_admin','supabase_admin','authenticator']
  loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
create schema if not exists auth;
SQL

echo "==> Restoring $DUMP"
# Not --single-transaction: a scratch restore should surface every error it
# hits rather than stopping at the first, so the report below is complete.
RESTORE_LOG=$(mktemp)
if ! psql "$SCRATCH_URL" -q --file "$DUMP" >"$RESTORE_LOG" 2>&1; then
  echo "    (psql exited non-zero -- see errors below)"
fi

# The dump was taken with --clean, so it opens with DROP statements. Against
# an empty scratch database every one of those fails, and `DROP CONSTRAINT IF
# EXISTS` still errors when the *table* is missing -- IF EXISTS covers the
# constraint, not its table. Those are inherent to a clean-dump-into-empty
# restore and say nothing about the backup. Counting them as failures would
# make a perfectly good backup look broken, so they are separated out rather
# than hidden: the raw total is still printed.
TOTAL=$(grep -c '^psql:.*ERROR' "$RESTORE_LOG" 2>/dev/null || true)
EXPECTED=$(grep '^psql:.*ERROR' "$RESTORE_LOG" 2>/dev/null | grep -c 'does not exist' || true)
REAL=$(( ${TOTAL:-0} - ${EXPECTED:-0} ))

echo "==> Restore finished: ${REAL} unexpected error(s)"
echo "    (${EXPECTED:-0} of ${TOTAL:-0} were \"does not exist\" from the dump's own"
echo "     DROP statements hitting an empty database -- expected, not a problem)"

if [[ "$REAL" -gt 0 ]]; then
  echo "--- unexpected errors (first 15) ---"
  grep '^psql:.*ERROR' "$RESTORE_LOG" | grep -v 'does not exist' | head -15 | sed 's/^/    /'
  echo "------------------------------------"
fi
rm -f "$RESTORE_LOG"

echo
echo "==> Row counts in the restored copy"
psql "$SCRATCH_URL" -q -X -A -F $'\t' <<'SQL' | sed 's/^/    /'
select 'auth.users', count(*) from auth.users
union all select 'meditations', count(*) from public.meditations
union all select 'collections', count(*) from public.collections
union all select 'collection_items', count(*) from public.collection_items
union all select 'favorites', count(*) from public.favorites
union all select 'script_generation_events', count(*) from public.script_generation_events
union all select 'audio_generation_events', count(*) from public.audio_generation_events
order by 1;
SQL

echo
echo "==> Sanity check: meditations that still have a script"
psql "$SCRATCH_URL" -q -X -A -t <<'SQL' | sed 's/^/    /'
select count(*) || ' of ' || (select count(*) from public.meditations) || ' have a non-empty script'
from public.meditations where script is not null and length(trim(script)) > 0;
SQL

echo
echo "Scratch database will be dropped on exit."
echo "Review the counts above: a clean restore of zero rows is not a backup."
