---
id: 01M7XJYY59Y7W8ERSHKSQMNX44
kind: how-to
status: proposed
title: "Seeing rating UI locally: seed has no ratings, insert one with the touch trigger off"
tags: [ratings, local-dev]
paths: []
source: run f794011d
confidence: 0.6
supersedes: none
created: 2026-11-20
---

supabase/seed.sql creates public completed meditations (dddd000N-…, split between alice and bob) but no meditation_ratings rows, so the rating UI shows nothing locally until a row exists. To see it, insert a rating by the other seeded user through psql on 127.0.0.1:54322. Run `set session_replication_role = replica` first if you need a backdated created_at/updated_at, because the meditation_ratings_touch trigger otherwise resets them. Delete the row afterwards: every worktree shares the local database, so never reset it.

Evidence: ZEN-10 browser check of src/components/meditation-ratings.tsx
