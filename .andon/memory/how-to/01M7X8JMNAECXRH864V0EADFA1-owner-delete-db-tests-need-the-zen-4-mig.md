---
id: 01M7X8JMNAECXRH864V0EADFA1
kind: how-to
status: proposed
title: Owner-delete DB tests need the ZEN-4 migration applied to the shared local stack
tags: [supabase, testing]
paths: [src/test/owner-delete.db.test.ts]
source: review PR 136
confidence: 0.7
supersedes: none
created: 2026-11-20
---

The local Supabase is shared by every worktree, so another worktree's reset can leave it without this branch's migrations. When src/test/owner-delete.db.test.ts fails on 'keeps the audio ledger row' with null, run `supabase migration up --local` (local only), then `set -a; . ./.env.local; set +a; SUPABASE_DB_TESTS=1 npx vitest run src/test/`. Check the FK with psql on 127.0.0.1:54322: confdeltype 'n' means set null.
