# Analytics

**Status:** Not started
**Priority:** Post-ship

> **Update `/privacy` in the same PR.** The policy states that Zenerate uses no
> analytics or tracking tools and lists every service provider by name. Adding an analytics tool
> makes that false the day it ships.

## Why it matters
After ship, we need to know: how many signups, how many of those generate a script, how many generate audio, how many return, where users drop off. Without this, product decisions are pure guesswork.

## Scope sketch
- **Pageview tracking** — Vercel Analytics (cheap, built-in) or PostHog (more features, free tier generous)
- **Event tracking** — signup, first script generated, first audio generated, favorite, add-to-collection, play audio, download, quota-hit
- **Funnel analysis** — landing → signup → first script → first audio → retained on day 7
- **Privacy-first** — cookieless if possible, respect DNT, disclose in privacy policy

## Key decisions to make
- Vercel Analytics for minimum viable vs. PostHog for real product insight? PostHog if we expect to make more than one product decision based on data.
- Self-host PostHog or use cloud? Cloud for v1 — self-hosting is its own ops burden.
- Session replay (PostHog feature): useful for debugging real user flows, but heavier on privacy implications and storage.

## Implementation notes
- PostHog has a Next.js integration: `posthog-js` in a provider component. Init in a top-level client component.
- Server-side events (for auth/billing flows): use `posthog-node` from API routes.
- Event naming convention: `noun_verb` past tense (`meditation_created`, `audio_generated`). Consistent naming pays off when funnels get built.
- Never send PII (email, script content) in event properties — only IDs.
