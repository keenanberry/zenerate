---
id: 01M7X89S9NW4HJEHC15Q8PFFY5
kind: gotchas
status: proposed
title: A foreign key to meditations that cascades can refund a spend ledger
tags: [supabase, quota, security]
paths: [supabase/migrations/**, src/lib/meditation/delete.ts]
source: run 2d099bbd
confidence: 0.6
supersedes: none
created: 2026-11-20
---

The spend caps count ledger rows (audio_generation_events by user and month). Until ZEN-4 that table's meditation_id was `on delete cascade`, so deleting a meditation deleted its render rows and handed the monthly slots back. Once owners could delete, that became make-delete-remake with no cap. A table that a cap counts must reference meditations with `on delete set null` (and a nullable column), never cascade. Content tables (versions, plays, favorites, future ratings and bookmarks) should cascade. src/test/owner-delete.db.test.ts checks both kinds. When you add a table that references meditations, add it there.

Evidence: ZEN-4: owner-delete.db.test.ts 'keeps the audio ledger row' failed before supabase/migrations/20261120010000_keep_audio_ledger_on_delete.sql
