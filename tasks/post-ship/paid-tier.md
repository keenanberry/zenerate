# Paid Tier

**Status:** Not started. Scoped for a future session (rewritten 2026-10-22 with real cost numbers)
**Priority:** Post-ship, but **decide the free tier before opening signups.** See "Before
signups" below.

## Why it matters

The operator: "I feel my Claude credits and ElevenLabs credits wouldn't last long if actual
people started signing up." That's right, and it's sharper than when this file was first
written. The studio made each meditation a conversation, and conversations are where
Anthropic spend now lives.

## What a meditation costs us (estimates; verify against real usage)

Measured or configured in the repo:
- **ElevenLabs:** about 930 speech characters per meditation (ship 06, measured on seeded
  scripts). On Starter ($6 for 30k credits), that's roughly **$0.19 per render**; on Creator
  ($22 for about 121k), roughly **$0.17**. Longer meditations cost proportionally more, and so
  does every re-render of a revision.
- **Anthropic:** the studio runs `claude-sonnet-5` at $2 / $10 per MTok (input / output), with
  low-effort thinking, up to 8k output tokens and 5 steps per turn. The tools and system prompt
  are prompt-cached. A turn that writes a 10-minute script is roughly 2–4k output tokens plus
  a few thousand input tokens, so about **$0.03–0.06 per writing turn**. A typical meditation
  (a draft, a revision or two, "Make the audio") is **3–6 turns, so about $0.15–0.30.**
  Verify this against the Anthropic console before pricing: per-request token counts are on
  each `chat_messages` turn if usage metadata gets logged, and they aren't today.
- **Total: about $0.35–0.50 per finished meditation.** Stripe takes 2.9% + $0.30 per charge,
  so **a $5/month plan nets about $4.55, which covers roughly 9–13 meditations a month** before
  fixed costs.

Fixed costs that change when you charge money:
- **Vercel Hobby prohibits commercial use.** Charging means **Vercel Pro, $20/month**
  (go-live spec).
- **Supabase Free** is fine until there's data worth backing up properly. Pro is $25/month.
- **ElevenLabs** moves up a plan as renders grow. The global cap
  (`MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`, 25 today) is what keeps it under the plan's
  credits.

So $5/month works for regular users if paid plans carry a render cap (for example 15 a month).
It doesn't cover the fixed costs until there are about 10 paying users.

## Before signups: the free tier's real exposure

Independent of whether you charge, check these before task 38 enables signups:
- **The daily chat ceiling is 200 messages per user** (`PER_USER_DAILY_CHAT_MESSAGES`, ship 29).
  At about $0.05 per writing turn, one determined free user could spend around **$10 a day**
  of Anthropic. A free-tier ceiling of about 30 a day still allows several meditations.
  Consider a lower free value, or a per-user monthly token budget.
- **Free renders are 3 a month per user**, with the global cap of 25 as the backstop. When
  the cap is hit, everyone waits until next month, which is safe but frustrating. That's
  fine at hobby scale.
- **An Anthropic spend limit and auto-reload**, in the operator TODO, are the real safety net.

## Scope sketch

- **Plans.** Start with one paid plan, for example **Plus at $5/month**: about 15 renders a
  month, a higher chat ceiling, every voice and ambience. Free stays at 3 renders and a low
  chat ceiling. Annual pricing (for example $48/year) is cheap to add with Stripe.
- **Billing.** Two options:
  - **Stripe Checkout + Customer Portal + webhooks** to a `subscriptions` table (or a tier
    column), never trusting the client. Log raw events to `stripe_events` for replay.
  - **Lemon Squeezy or Paddle**, if you'd rather they act as merchant of record and handle
    international VAT and sales tax. They cost more per sale but there's no tax work.
- **The quota layer reads the plan.** `src/lib/audio/quota.ts` already takes a per-user cap
  and has the exemption path (`QUOTA_EXEMPT_USER_IDS`). The cap and the chat ceiling become
  lookups by plan.
- **Upgrade prompts in the studio.** When a free user hits a limit, the audio card or the
  chat says so and offers the upgrade inline. The audio card already shows "renders left".
- **Account page.** Billing lives with the profile and settings work
  (`tasks/post-ship/user-profiles.md`, `/account`).
- **Legal.** `/terms` needs billing and refund terms; `/privacy` needs the payment processor.

## Decisions to make

- **Free tier or trial?** A small free tier (3 renders, low chat ceiling) versus a 7-day trial
  then paid-only. Paid-only removes the cost exposure entirely, but makes the first visit
  harder.
- **What counts toward the cap:** renders only (as today) or also writing turns? Renders only
  is simpler to explain. The chat ceiling handles chat cost.
- **Failed renders:** the free retry (ship 03) carries over unchanged.
- **Cancel mid-month:** access to the end of the period, then the free tier.
- **Custom voices** (ElevenLabs cloning) as a higher tier later. That needs a moderation story.

## Implementation notes

- Measure first. Add token usage to `generation_meta` or a small usage table per chat turn
  (`streamText`'s usage on finish), so the pricing decision rests on your real numbers, not
  these estimates. `generation_meta.tts_characters` already records ElevenLabs usage per
  render.
- Webhook endpoints verify signatures. The plan lives in a server-written column.
