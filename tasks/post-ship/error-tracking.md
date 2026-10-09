# Error Tracking

**Status:** Not started
**Priority:** Post-ship

> **Update `/privacy` in the same PR.** The policy states that Zenerate uses no
> analytics or tracking tools and lists every service provider by name. Adding an error tracker (which receives request data)
> makes that false the day it ships.

## Why it matters
`error.tsx` boundaries (ship task 10) catch errors at render but don't tell the operator anything happened. In production, real errors need to be reported somewhere so they can be triaged and fixed. Also critical for the audio pipeline — a workflow can fail silently if no one's watching the logs.

## Scope sketch
- **Sentry** (or Highlight, Rollbar — pick one) for client and server error capture
- Wire into `error.tsx`, `global-error.tsx`, and the root `instrumentation.ts` for automatic capture
- Capture workflow failures from `src/lib/audio/workflow.ts` — currently a `catch` block that sets status to `failed`; add a Sentry call
- Source maps uploaded on deploy (Next.js + Sentry has a webpack plugin for this)
- User context attached (user ID, not email) so errors can be grouped by impacted users
- Alerting threshold configured (e.g., "ping me if any error hits 5+ users")

## Key decisions to make
- Sentry is the default choice — good free tier, mature Next.js integration. Consider alternatives only if cost becomes an issue.
- Session replay add-on: valuable for frontend bugs, privacy implications — decide once real bugs appear.

## Implementation notes
- `@sentry/nextjs` has a guided setup wizard (`npx @sentry/wizard@latest -i nextjs`) that handles most of the config.
- Sensitive data: scrub request bodies, especially `/api/generate` (script prompts may be personal) and anything carrying user input.
- Source map upload adds a step to Vercel build — ensure `SENTRY_AUTH_TOKEN` is set as a Vercel env var.
- Tag errors with `tier: 'free' | 'paid'` once paid tier exists — helps prioritize paid-user-impacting bugs.
