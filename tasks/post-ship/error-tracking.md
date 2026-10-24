# Error Tracking

**Status:** Done* (code merged with no DSN; the Sentry account is an operator item)
**Priority:** Pre-launch. Promoted to ship task 51 on 2026-10-23

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

## Outcome

Built with `@sentry/nextjs` 11.9 (the current major; its `withSentryConfig` lives at
`@sentry/nextjs/config`, and `dataCollection` replaced `sendDefaultPii`). No wizard: its
output was written by hand to fit the App Router layout here.

- `src/instrumentation.ts` inits Node and edge and exports `onRequestError`;
  `src/instrumentation-client.ts` inits the browser and exports `onRouterTransitionStart`.
  With no `NEXT_PUBLIC_SENTRY_DSN` neither inits, so every Sentry call is a no-op.
- `src/lib/sentry/options.ts` holds the shared options: errors only (no tracing, replay or
  release-health sessions), every `dataCollection` category off (bodies, cookies, headers,
  query strings, AI inputs and outputs, stack-frame variables), and `scrubEvent` /
  `scrubBreadcrumb` as a second filter. Tested.
- User id, never email: the browser follows Supabase's `onAuthStateChange`; the server
  wraps `auth.getUser` in `src/lib/supabase/server.ts`.
- Captured explicitly besides the boundaries (`error.tsx`, `(app)/error.tsx`,
  `global-error.tsx`): chat stream and save failures, a workflow that fails to start, a
  failed render (in the `markFailed` step, tagged with the meditation and owner, flushed
  before the step ends) and the keepalive cron.
- Source maps upload only when `SENTRY_AUTH_TOKEN` is set, and are deleted after; without
  it none are generated. Sentry's build telemetry is off.
- Verified locally against a fake DSN: a server route error with a JSON body, cookie and
  query string arrived as method, path and user id only; a client render error arrived
  with the user id and no query; no session envelopes.
- `/privacy` names Sentry and what a report contains. Account steps, IP storage off and
  the 5-users alert are in `tasks/OPERATOR-TODO.md`.

Not done: the `tier` tag waits for a paid tier; session replay stays off.
