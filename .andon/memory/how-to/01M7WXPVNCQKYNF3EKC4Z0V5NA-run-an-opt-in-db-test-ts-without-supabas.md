---
id: 01M7WXPVNCQKYNF3EKC4Z0V5NA
kind: how-to
status: proposed
title: Run an opt-in *.db.test.ts without supabase db reset
tags: [testing, supabase]
paths: [src/test/**, supabase/migrations/**]
source: review PR 134
confidence: 0.7
supersedes: none
created: 2026-11-20
---

src/test/*.db.test.ts files run only with SUPABASE_DB_TESTS=1 and need the migration applied. To test an unmerged migration on the shared local stack without a reset, apply it with `psql $DB_URL -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql` (this does not record it in schema_migrations), run `SUPABASE_DB_TESTS=1 npx vitest run src/test/<name>.db.test.ts`, then drop what the migration created (its triggers on auth.users, its functions, its tables) and `notify pgrst, 'reload schema'`. PostgREST must see the objects, so a rolled-back transaction is not enough for supabase-js tests.
