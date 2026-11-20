---
id: 01M7XGNVNXSYV3F0QYHNM1309W
kind: gotchas
status: proposed
title: Sign-in and sign-out are client-side navigations, so module-level client state survives a change of account
tags: [auth, client-state]
paths: [src/components/nav.tsx, src/app/(auth)/login/login-form.tsx, src/lib/**]
source: review PR 140
confidence: 0.7
supersedes: none
created: 2026-11-20
---

Nav's handleSignOut does router.push('/') and the login form's signedIn() does router.replace(next), neither a full reload. Any module-scope store in a client module (e.g. src/lib/meditation/bookmark-state.ts) keeps the previous account's data into the next session in the same tab. Clear such stores in both places (see resetBookmarkOverrides) or key them by user.
