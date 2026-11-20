---
id: 01M7XJVFCSXCDK3ZY949AVCYD5
kind: gotchas
status: proposed
title: The repo has no Prettier config; a bare `npx prettier --write` rewraps lines at 80 columns
tags: [tooling, formatting]
paths: []
source: run 25020d25
confidence: 0.6
supersedes: none
created: 2026-11-20
---

There is no .prettierrc and no prettier script in package.json, and the TSX here is written to roughly 100 columns. Running `npx prettier --write <file>` with defaults rewraps untouched lines at 80 and bloats the diff. Either format by hand or pass `--print-width 100`, and check `git diff --stat` afterwards for lines you did not mean to change. eslint (`npx eslint <files>`) is the only enforced style check.

Evidence: ZEN-11: prettier at defaults turned a ~40-line change in src/components/account-creations.tsx into a 97-line diff; --print-width 100 brought it back.
