---
id: 01M7XB8RWJHTX4C2NQ5HGMPRPX
kind: conventions
status: proposed
title: Component tests are node-only static renders; keep UI rules in pure modules
tags: [testing, conventions]
paths: []
source: run 268f3e74
confidence: 0.6
supersedes: none
created: 2026-11-20
---

vitest runs with `environment: "node"` and the repo has no testing-library or jsdom, so component tests render with `renderToStaticMarkup` and assert on the markup (aria attributes, labels, text); clicks, effects and storage cannot be exercised there. Put the decisions a component makes (when to show something, how a value is formatted) in a pure module under src/lib and unit-test that, as src/lib/meditation/rating-display.ts does for the rating prompt, and check the interactive behaviour in a headless browser instead.

Evidence: vitest.config.ts; src/components/profile-form.test.tsx; src/components/rating-prompt.test.tsx
