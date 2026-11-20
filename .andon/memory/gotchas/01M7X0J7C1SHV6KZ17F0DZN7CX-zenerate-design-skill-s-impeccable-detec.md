---
id: 01M7X0J7C1SHV6KZ17F0DZN7CX
kind: gotchas
status: proposed
title: "zenerate-design skill's impeccable detect path does not exist"
tags: [design, tooling]
paths: [.claude/skills/zenerate-design/**]
source: run 9b82b876
confidence: 0.6
supersedes: none
created: 2026-11-20
---

The zenerate-design skill says to run `~/.claude/skills/impeccable/scripts/impeccable detect --json <files>`, but that path does not exist on this machine. The script lives in the impeccable plugin instead; find it with `find ~/.claude -path '*impeccable/scripts/impeccable' -type f` (currently under ~/.claude/plugins/marketplaces/impeccable/.veto/skills/impeccable/scripts/). It prints [] when there is nothing to report.

Evidence: ZEN-3: step 6 of .claude/skills/zenerate-design/SKILL.md failed with 'no such file or directory'
