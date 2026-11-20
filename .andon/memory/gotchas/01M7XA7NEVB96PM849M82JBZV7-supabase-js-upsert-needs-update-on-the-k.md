---
id: 01M7XA7NEVB96PM849M82JBZV7
kind: gotchas
status: proposed
title: supabase-js upsert needs UPDATE on the key columns; with column-narrowed grants, update then insert
tags: [supabase, rls, grants]
paths: [supabase/migrations/**, src/lib/**]
source: run cc7197b1
confidence: 0.6
supersedes: none
created: 2026-11-20
---

PostgREST's upsert (supabase-js .upsert) runs INSERT ... ON CONFLICT DO UPDATE SET for every column in the payload, the conflict keys included, so Postgres needs an UPDATE grant on those key columns too. This repo narrows authenticated's UPDATE grants by column (task 58 style), so an upsert on such a table fails with 42501. Update first with .eq() filters and .select(); if no row came back, insert; on 23505 (a concurrent insert won) update again. See rateMeditation in src/lib/meditation/ratings.ts. A 42501 from a write whose RLS check references another table (e.g. the meditation went private meanwhile) is a 404, not a 500.

Evidence: ZEN-5: meditation_ratings grants update (stars) only; rateMeditation and src/test/meditation-ratings.db.test.ts
