---
id: 01M7XGHGHRF5QA7C057B4961C2
kind: gotchas
status: proposed
title: "A server component that imports a value from a \"use client\" module gets a client reference, not the value"
tags: [nextjs, rsc, client-components]
paths: [src/app/**, src/components/**]
source: run 636daefa
confidence: 0.6
supersedes: none
created: 2026-11-20
---

Only components cross the "use client" boundary as values. A constant (a page size, a label map) exported from a "use client" file and imported by a server component arrives as a client-reference proxy: typecheck passes, nothing throws, and arithmetic on it gives NaN. In ZEN-8 the /account page passed such a page size to listBookmarks, `rows.slice(0, NaN)` returned nothing, and the list showed its empty state although the database held rows. Put shared constants and pure helpers in a plain module under src/lib (here src/lib/meditation/bookmark-state.ts) and import them from both sides. A render test of the client component alone will not catch it; check the page in a browser.

Evidence: ZEN-8: ACCOUNT_BOOKMARK_PAGE first lived in src/components/account-bookmarks.tsx; /account showed "Nothing saved yet" with two rows in meditation_bookmarks until it moved to src/lib/meditation/bookmark-state.ts
