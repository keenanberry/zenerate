---
id: 01M7X8JMNFZX919S7KE770M76Y
kind: gotchas
status: proposed
title: "The studio's meditationId comes from tool outputs in chat history, not only chats.meditation_id"
tags: [studio, chat]
paths: [src/components/studio/drafts.ts, src/components/studio/studio.tsx]
source: review PR 136
confidence: 0.7
supersedes: none
created: 2026-11-20
---

Studio derived its meditation id from the latest writeScript output in the messages. After a meditation is deleted, the chat keeps those outputs while chats.meditation_id goes null, so the history points at a dead id. currentMeditationId in src/components/studio/drafts.ts drops ids from the loaded history when the chat loads unlinked. Any new client code that reads ids from tool outputs needs the same care.
