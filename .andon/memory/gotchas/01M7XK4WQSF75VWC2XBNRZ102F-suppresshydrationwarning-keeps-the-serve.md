---
id: 01M7XK4WQSF75VWC2XBNRZ102F
kind: gotchas
status: proposed
title: "suppressHydrationWarning keeps the server's text; it does not let the browser's win"
tags: [react, hydration, dates]
paths: [src/components/meditation-ratings.tsx]
source: review PR 142
confidence: 0.7
supersedes: none
created: 2026-11-20
---

On a text mismatch, React does not patch an element marked suppressHydrationWarning. The server-rendered text stays, and a later re-render that computes the same string does not touch the DOM either. For time-zone-dependent text (relative dates such as ratedAgo in meditation-ratings.tsx), render it only after hydration, for example with useSyncExternalStore(noop, () => true, () => false), and keep a placeholder in the server HTML.
