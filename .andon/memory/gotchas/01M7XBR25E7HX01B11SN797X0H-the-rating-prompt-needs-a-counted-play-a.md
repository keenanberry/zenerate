---
id: 01M7XBR25E7HX01B11SN797X0H
kind: gotchas
status: proposed
title: "The rating prompt needs a counted play: a local test clip must be longer than 30 seconds"
tags: [testing, ratings, audio]
paths: [src/components/use-waveform-player.ts, src/components/use-play-tracking.ts, src/lib/meditation/rating-display.ts]
source: review PR 138
confidence: 0.7
supersedes: none
created: 2026-11-20
---

Since the ZEN-6 review, the end-of-session rating prompt shows only after useWaveformPlayer's `heard` turns true. That happens when watchPlays counts a play: 30 s actually heard, with seeks not counting. A short clip (like the 12-second one in how-to 01M7XB8RSJC5F0K4Y4YYK1XNVC), or seeking with the Position slider's End key, will never trigger it. To browser-check the prompt, use a clip of about 40 s or more, let 30 s play, then seek to the end.
