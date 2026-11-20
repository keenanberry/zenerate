---
id: 01M7WWS04Z5A96PE71HWNZ83BP
kind: how-to
status: proposed
title: Test a new migration against local Supabase without db reset
tags: []
paths: [supabase/migrations/**]
source: run ce051a6c
confidence: 0.6
supersedes: none
created: 2026-11-20
---

The local Supabase stack is shared by every worktree, so `supabase db reset` would wipe other runs' data. To check a new migration's grants and RLS, run it inside a transaction you roll back: write a psql script that does `begin; \i supabase/migrations/<file>.sql`, then `set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', '<user id>', 'role','authenticated')::text, true);` and the reads and writes you expect to pass or fail (the seeded test users from supabase/seed.sql are in auth.users), `set local role anon` for signed-out checks, and end with `rollback;`. Run it with psql against the DB_URL that `supabase status -o env` prints.

Evidence: ZEN-2: verified supabase/migrations/20261120000000_user_profiles.sql this way
