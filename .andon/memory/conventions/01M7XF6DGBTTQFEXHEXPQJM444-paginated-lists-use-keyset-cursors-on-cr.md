---
id: 01M7XF6DGBTTQFEXHEXPQJM444
kind: conventions
status: proposed
title: Paginated lists use keyset cursors on (created_at, id); keep the timestamp as text and quote it in .or()
tags: [supabase, api, pagination]
paths: [src/lib/**, src/app/api/**]
source: run 5b794fb1
confidence: 0.6
supersedes: none
created: 2026-11-20
---

GET /api/bookmarks is the repo's first paginated API route. It takes ?limit= (1-100, default 50, as discover_meditations' row_limit) and an opaque ?cursor= (base64url of "created_at|id"), and returns { items, next_cursor } with next_cursor null on the last page; fetch limit+1 rows to know whether there is a next. Order by created_at desc then id desc, and filter the next page with .or(`created_at.lt."<ts>",and(created_at.eq."<ts>",id.lt.<id>))`. Keep created_at as the string PostgREST returned: a JS Date drops microseconds and the cursor then skips or repeats rows. Validate both parts with a regex before they go into the filter string. To hide rows whose parent became invisible, embed with meditations!inner(...) and filter .eq("meditation.is_public", true) so pages stay full. See listBookmarks and parseBookmarkPage in src/lib/meditation/bookmarks.ts.

Evidence: ZEN-7: src/lib/meditation/bookmarks.ts; the tie-on-created_at paging test in src/test/meditation-bookmarks.db.test.ts
