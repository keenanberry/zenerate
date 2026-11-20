---
id: 01M7XDW5X2QQTR64YZYEP610VM
kind: gotchas
status: proposed
title: "The Andon QA browser's theme toggle never switches themes; use a fresh context or Playwright for light-theme checks"
tags: [testing, qa, ui]
paths: [src/components/theme-toggle.tsx, src/app/layout.tsx]
source: run QA PR 138
confidence: 0.7
supersedes: none
created: 2026-11-20
---

In the QA browser, clicking 'Toggle theme' left html.dark in place on every page, including ones a PR didn't touch. A plain Playwright Chromium against the same server switched on the first click with no console errors, so the app is fine. A QA browser context that has stayed open a long time can also stop responding to clicks altogether (Play, favorite) while qa_wait still reports old fetches as in flight. If that happens, qa_close and qa_open a fresh one. For light-theme evidence, use a scratch Playwright script with addInitScript(() => localStorage.setItem('theme','light')), launched with the cached chrome-headless-shell (how-to 01M7X89S62R5G9RQE4KTK0Q5M3).
