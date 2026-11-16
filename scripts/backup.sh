#!/usr/bin/env bash
#
# Take a production backup, verify it, and copy it off this Mac: the weekly
# routine from docs/runbooks/backup-restore.md as one command.
#
# Usage:  ./scripts/backup.sh [off-site-folder]
#
#   1. pg_dump production (public + auth) to ~/backups/zenerate/zenerate-YYYY-MM-DD.sql
#   2. copy it with `cp -p` to the off-site folder: the argument, or
#      ZENERATE_BACKUP_OFFSITE. `-p` keeps the file's date, which the prune goes by.
#   3. restore it into a throwaway local database with verify-backup.sh, which
#      needs the local stack (`supabase start`). The script fails if it can't.
#
# The database password comes from, in order:
#   - PGPASSWORD, if set
#   - the macOS Keychain item "zenerate-db". Save it once, and it prompts for the value:
#       security add-generic-password -s zenerate-db -a postgres -w
#     After a password reset, run that again with -U to update it.
#   - a hidden prompt
# It never goes on the command line, into a file, or to verify-backup.sh.
#
# ZENERATE_DB overrides the libpq connection string (for testing against a
# local database). ZENERATE_BACKUP_DIR overrides ~/backups/zenerate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONNINFO="${ZENERATE_DB:-host=aws-0-us-east-1.pooler.supabase.com port=5432 user=postgres.xnvqjqobegcpkigkmoct dbname=postgres sslmode=require}"
BACKUP_DIR="${ZENERATE_BACKUP_DIR:-$HOME/backups/zenerate}"
OFFSITE="${1:-${ZENERATE_BACKUP_OFFSITE:-}}"

command -v pg_dump >/dev/null 2>&1 || { echo "error: pg_dump not found in PATH" >&2; exit 69; }

password="${PGPASSWORD:-}"
unset PGPASSWORD
if [[ -z "$password" ]] && command -v security >/dev/null 2>&1; then
  password="$(security find-generic-password -s zenerate-db -w 2>/dev/null || true)"
fi
if [[ -z "$password" ]]; then
  if ! (: </dev/tty) 2>/dev/null; then
    echo "error: no password and no terminal to ask in. Set PGPASSWORD, or save it in" >&2
    echo "       the Keychain once: security add-generic-password -s zenerate-db -a postgres -w" >&2
    exit 64
  fi
  read -rsp "Production database password: " password </dev/tty
  echo
fi

# Dumps hold every account's email and password hash: keep them owner-only.
umask 077
mkdir -p "$BACKUP_DIR"
DUMP="$BACKUP_DIR/zenerate-$(date +%Y-%m-%d).sql"
# Write to .partial first, so a failed dump never leaves a half-written
# zenerate-*.sql behind that looks like a backup.
PARTIAL="$DUMP.partial"
trap 'rm -f "$PARTIAL"' EXIT

echo "==> Dumping to $DUMP"
PGPASSWORD="$password" pg_dump "$CONNINFO" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --schema=public --schema=auth \
  --file="$PARTIAL"
password=""
mv "$PARTIAL" "$DUMP"
echo "    $(du -h "$DUMP" | cut -f1 | tr -d ' ')"

if [[ -n "$OFFSITE" ]]; then
  echo "==> Copying to $OFFSITE"
  mkdir -p "$OFFSITE"
  cp -p "$DUMP" "$OFFSITE/"
else
  echo "==> No off-site folder given: this dump is only on this Mac."
  echo "    Pass one, or set ZENERATE_BACKUP_OFFSITE."
fi

echo
"$SCRIPT_DIR/verify-backup.sh" "$DUMP"
