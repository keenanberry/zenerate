#!/usr/bin/env bash
#
# Install (or update) a launchd job that deletes backup dumps and deletion
# records once they are 29 days old, every day and at every login.
#
# /privacy promises that backups hold deleted data for at most 30 days. A
# prune that only runs when someone remembers to take a backup stops when the
# backups stop, so the prune runs on its own schedule. The job calls
# /usr/bin/find directly rather than a script in this repo, so it keeps
# working when this checkout moves or is deleted.
#
# Usage:  ./scripts/schedule-backup-prune.sh [--dry-run] [extra-dir ...]
#
# ~/backups/zenerate is always pruned. Pass each other folder that holds a
# copy of the dumps (the cloud-drive copy) as an extra argument. Run it again
# with the full list to change the folders. --dry-run prints the plist and
# installs nothing.

set -euo pipefail

LABEL="com.zeneratestudio.backup-prune"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/backups/zenerate/prune.log"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

DIRS=("$HOME/backups/zenerate" "$@")
for dir in "${DIRS[@]}"; do
  if [[ "$dir" != /* ]]; then
    echo "error: use an absolute path: $dir" >&2
    exit 64
  fi
done

xml_escape() {
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  printf '%s' "$s"
}

args=("/usr/bin/find" "${DIRS[@]}")
# 29 whole days old: a daily run removes a dump before it turns 30.
# deletions/ holds one file per handled deletion request (see the runbook);
# a record outlives every dump older than it, which is all it is needed for.
# No -print: record names hold user ids, and the log is never pruned.
args+=("-type" "f" "(" "-name" "zenerate-*.sql" "-o" "-path" "*/deletions/*" ")"
  "-mtime" "+28" "-delete")

program_args=""
for arg in "${args[@]}"; do
  program_args+="    <string>$(xml_escape "$arg")</string>"$'\n'
done

plist=$(cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
$program_args  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$LOG")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$LOG")</string>
</dict>
</plist>
PLIST
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '%s\n' "$plist"
  exit 0
fi

if [[ "$(uname)" != "Darwin" ]]; then
  echo "error: this installs a macOS launchd job. Use --dry-run to see what it runs." >&2
  exit 69
fi

for dir in "${DIRS[@]}"; do
  [[ -d "$dir" ]] || echo "warning: $dir does not exist yet; find will log an error until it does" >&2
done

mkdir -p "$HOME/backups/zenerate/deletions" "$HOME/Library/LaunchAgents"
# A Time Machine snapshot would keep every pruned dump for as long as the
# snapshot lives. The off-site copy is the second copy, not Time Machine.
tmutil addexclusion "$HOME/backups/zenerate" 2>/dev/null \
  || echo "warning: could not exclude ~/backups/zenerate from Time Machine; do it in System Settings" >&2
printf '%s\n' "$plist" > "$PLIST"
plutil -lint "$PLIST" >/dev/null

domain="gui/$(id -u)"
launchctl bootout "$domain/$LABEL" 2>/dev/null || true
launchctl bootstrap "$domain" "$PLIST"

echo "Installed $PLIST"
echo "It ran once just now and runs daily at 09:00 and at login."
echo "Errors are logged to $LOG. It logs nothing on success, because deletion"
echo "records name the user ids they hold, and the log is kept."
