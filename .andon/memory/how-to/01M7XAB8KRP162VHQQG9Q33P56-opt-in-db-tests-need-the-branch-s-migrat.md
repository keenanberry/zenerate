---
id: 01M7XAB8KRP162VHQQG9Q33P56
kind: how-to
status: proposed
title: "Opt-in DB tests need the branch's migration applied locally first"
tags: [supabase, testing]
paths: [src/test/**, supabase/migrations/**]
source: review PR 137
confidence: 0.7
supersedes: none
created: 2026-11-20
---

Before running SUPABASE_DB_TESTS=1 on a branch that adds a migration, run `supabase migration up --local`. Otherwise PostgREST answers 'Could not find the table ... in the schema cache' and every test in that file fails. Load .env.local into the shell for the keys (set -a; source .env.local; set +a). Then `SUPABASE_DB_TESTS=1 npx vitest run src/test/`.
