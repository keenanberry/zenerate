---
id: 01M7XJYY8PKWNZN30YD6J4W0GN
kind: gotchas
status: proposed
title: "zenerate-design skill's impeccable detect path does not exist on this machine"
tags: []
paths: [.claude/skills/zenerate-design/**]
source: run f794011d
confidence: 0.6
supersedes: none
created: 2026-11-20
---

Step 6 of .claude/skills/zenerate-design says to run `~/.claude/skills/impeccable/scripts/impeccable detect --json <files>`, but that path does not exist. The script is installed with the impeccable plugin under ~/.claude/plugins/marketplaces/impeccable/ (find it with `find ~/.claude -path "*impeccable/scripts/impeccable" -type f`). Locate it with find rather than skipping the check.

Evidence: ZEN-10 run: "no such file or directory" running the skill's command
