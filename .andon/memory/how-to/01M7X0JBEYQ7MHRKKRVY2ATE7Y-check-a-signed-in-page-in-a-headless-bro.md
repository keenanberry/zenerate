---
id: 01M7X0JBEYQ7MHRKKRVY2ATE7Y
kind: how-to
status: proposed
title: Check a signed-in page in a headless browser against the local stack
tags: [testing, ui, supabase]
paths: []
source: run 9b82b876
confidence: 0.6
supersedes: none
created: 2026-11-20
---

To check a page behind the (authed) gate, start `npx next dev -p <port>` in the background and drive it with Playwright (install it in a scratch folder, not the repo; browsers are already cached in ~/Library/Caches/ms-playwright). Sign in at /login through the UI: click the first button whose name matches /password/i to reach the password step, fill #email and #password with a seeded test user from CLAUDE.md, and submit. Theme is next-themes: set localStorage 'theme' to 'dark' or 'light' with page.addInitScript before loading the page. If a migration already on main is missing from the shared local DB (`supabase migration list --local` shows an empty Local column), `supabase migration up --local` applies it without a reset. Put back any seeded rows you changed when you are done.

Evidence: ZEN-3: verified /account end to end this way (redirect, PATCH, persistence on reload, dark/light, 390px)
