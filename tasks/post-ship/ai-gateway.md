# Route Model Calls Through Vercel AI Gateway

**Status:** Not started. The Gateway is already on for the zenerate Vercel project (free
tier); generated covers use it for images first
(`docs/superpowers/specs/2026-11-21-generated-cover-art-design.md`).
**Priority:** Post-ship
**Related:** [Analytics](./analytics.md), [Error tracking](./error-tracking.md), [Admin dashboard](./admin-dashboard.md)

## What changed (2026-11-21)

The operator's angle now: move the **studio chat agent** (`src/app/api/chat/`,
`STUDIO_MODEL` in `src/lib/chat/model.ts`) onto the Gateway, keeping their own Anthropic
key, and use it to **compare other models for script writing**.

- **Bring your own key.** The Anthropic key is added in the Gateway dashboard, so Claude
  calls bill to it while the Gateway adds per-request logging (tokens, latency, cost,
  errors): the visibility gap this task was written for. Decide whether
  `ANTHROPIC_API_KEY` stays in project env as a fallback.
- **Model comparison.** On the Gateway a model is a string (`anthropic/claude-sonnet-5-5`,
  `openai/...`, `google/...`). Extend `scripts/measure-studio-rewrites.ts` (task 47) to
  take Gateway model ids and score **whole studio conversations**, not only script
  quality: the studio leans on tool calls (`writeScript`, `setDetails`, `offerAudio`,
  `makeCover`) and on Anthropic prompt caching, which other models handle differently.
- **Tier.** The free tier is $5 of credit a month, limited to "free tier eligible" models
  and lower per-model rate limits (5 image requests a minute was observed). Buying
  credits moves the team to the paid tier and the monthly free credit stops. Cover
  generation needs paid credits before signups open anyway, so decide both together.
- **Auth.** Vercel deployments get an OIDC token automatically; local dev uses
  `vercel env pull` (`VERCEL_OIDC_TOKEN`, about 12h) or an `AI_GATEWAY_API_KEY`.

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
