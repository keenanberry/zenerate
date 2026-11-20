---
id: 01M7WXT9K09AJCVCFWZWGDNBVM
kind: gotchas
status: proposed
title: zod string validators return the raw input, not a normalised copy
tags: [validation, zod]
paths: [src/lib/profile/**]
source: review PR 134
confidence: 0.7
supersedes: none
created: 2026-11-20
---

z.url() (and similar zod format checks) test a parsed copy of the string but hand back the original. So characters the WHATWG URL parser silently percent-encodes or strips (NUL, tab, newline, space) survive into the stored value. Refuse them explicitly (e.g. /[\u0000- \u007f-\u009f]/) before a Postgres write, or NUL turns into a 500.
