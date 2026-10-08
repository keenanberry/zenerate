# Route Model Calls Through Vercel AI Gateway

**Status:** Not started
**Priority:** Post-ship
**Related:** [Analytics](./analytics.md), [Error tracking](./error-tracking.md), [Admin dashboard](./admin-dashboard.md)

## Why it matters

There is currently **no visibility into model usage at all**. `/api/generate` calls
Anthropic directly, and the only record that a generation happened is a row in
`script_generation_events` — which counts calls for quota purposes and knows nothing about
tokens, latency, cost, or failures.

That gap has already bitten. The worst-case cost figures in `quota.ts` are *derived from
`maxOutputTokens`*, not measured, because there is nothing measuring. The quota caps are
sized against an estimate of an estimate. Real per-call token counts would let those
numbers be based on what actually happens.

A gateway also gives failure visibility. Right now an Anthropic outage surfaces as a
generic error to the user and nothing to the operator — and per
[#5](https://github.com/keenanberry/zenerate/issues/5) it silently burns their quota slot
on the way out.

## Scope sketch

- Route `@ai-sdk/anthropic` calls through the Vercel AI Gateway
- Confirm per-request logging: tokens in/out, latency, cost, model, error rate
- Decide whether the gateway's own key management replaces `ANTHROPIC_API_KEY` in project
  env, or sits alongside it
- Feed real token counts back into the `quota.ts` cost derivation, replacing the estimate
- Keep the local path working — `scripts/measure-script-duration.ts` calls the model
  directly on purpose, and should keep doing so

## Key decisions to make

- **Does it cover the audio pipeline too?** ElevenLabs calls happen inside a Vercel Sandbox
  from `generate-audio.ts`, which is baked into the snapshot. Routing those is a separate
  and more awkward question, and that file cannot be changed without a snapshot rebuild.
- **Gateway vs. instrumenting ourselves.** Logging `response.usage` into
  `script_generation_events` would capture tokens and cost with no new dependency, and the
  ledger table already exists. That is a smaller change that solves most of the problem.
  The gateway earns its place if provider failover, caching, or multi-provider routing are
  wanted — not for logging alone.
- **Does it change the cost model?** Worth confirming the gateway's own pricing before
  adopting; the project runs at roughly $8/month and a per-request fee is not nothing at
  that scale.

## Implementation notes

- The AI SDK supports a gateway provider, so the call-site change in
  `src/app/api/generate/route.ts` should be small — but the `providerOptions.anthropic`
  block (adaptive thinking, `effort: "low"`) must survive the move. Verify thinking config
  still applies, since that was deliberate and measurable.
- If a gateway is adopted, re-run `scripts/measure-script-duration.ts` afterwards. It
  bypasses the route deliberately, so it will *not* catch a regression introduced at the
  route layer — that is the point of it, and also its blind spot here.
