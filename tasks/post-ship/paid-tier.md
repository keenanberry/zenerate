# Paid Tier

**Status:** Not started
**Priority:** Post-ship

## Why it matters
Free tier caps usage at 3 audio generations/month (task `ship/03`). That's fine for trial but not enough for regular practice. A paid tier monetizes power users and funds the ElevenLabs/Anthropic costs.

## Scope sketch
- **Pricing structure** — e.g., Free (3/mo), Plus ($9.99/mo → 30 generations, standard voices), Pro ($19.99/mo → 100 generations, custom voice cloning, premium voices, longer meditations)
- **Stripe integration** — subscriptions, webhooks to sync status to Supabase, customer portal for self-serve billing
- **Quota layer** — the same table/logic from `ship/03` but the cap is looked up from the user's tier
- **Custom voices** — ElevenLabs voice cloning upload flow; admin approval if we want moderation
- **Upgrade prompts** — when a free user hits their limit, surface the upgrade CTA inline (not just a generic "error")

## Key decisions to make
- Annual pricing discount?
- Grandfathering free tier users if we change limits later?
- Refund policy on failed generations still applies — does it work the same on paid?
- What happens when someone cancels mid-month? Access until period ends, then downgrade.

## Implementation notes
- `@supabase/supabase-js` has no Stripe integration — either use `@stripe/stripe-node` + webhook handler, or a service like Lemon Squeezy / Paddle if we want merchant-of-record handling for international VAT.
- Webhook endpoint must verify signatures. Log raw events to a `stripe_events` table for replay/debugging.
- Tier is a column on the user profile, updated by webhook. Never trust the client.
