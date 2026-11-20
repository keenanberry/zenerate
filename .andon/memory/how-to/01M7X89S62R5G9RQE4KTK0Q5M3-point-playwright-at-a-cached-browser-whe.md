---
id: 01M7X89S62R5G9RQE4KTK0Q5M3
kind: how-to
status: proposed
title: Point Playwright at a cached browser when its version has no download
tags: [testing, ui]
paths: []
source: run 2d099bbd
confidence: 0.6
supersedes: none
created: 2026-11-20
---

A fresh `npm i playwright` in a scratch folder usually wants a chromium build that ~/Library/Caches/ms-playwright does not have, and launch fails with 'Executable doesn't exist ... npx playwright install'. Don't download or guess versions: launch with `chromium.launch({ executablePath })`, taking the path from `ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-<newest>/*/chrome-headless-shell`. Separately, when you seed a throwaway meditation with a made-up audio_path for a UI check, the page logs 'Failed to sign audio path ... Object not found' and the Next dev overlay shows '1 Issue'. That comes from the fake path, not your change.

Evidence: ZEN-4: playwright latest wanted chromium_headless_shell-1255, 1.57.0 wanted 1200; cache held 1248. The dev overlay issue came from seeded r.mp3 paths missing from storage.
