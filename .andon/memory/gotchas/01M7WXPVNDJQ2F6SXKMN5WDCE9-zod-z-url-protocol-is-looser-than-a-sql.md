---
id: 01M7WXPVNDJQ2F6SXKMN5WDCE9
kind: gotchas
status: proposed
title: "zod z.url({protocol}) is looser than a SQL '^https://' check"
tags: [validation, zod]
paths: [src/lib/profile/**]
source: review PR 134
confidence: 0.7
supersedes: none
created: 2026-11-20
---

z.url({ protocol: /^https$/ }) validates with the WHATWG URL parser, which accepts 'HTTPS://x', 'https:x' and 'https:/x'. A Postgres check like avatar_url ~ '^https://' rejects them, so the write fails with 23514 and the route returns 500. Add .startsWith('https://') when the database checks the literal prefix. Also count lengths with [...s].length to match char_length, and refuse \u0000, which Postgres text cannot hold.
