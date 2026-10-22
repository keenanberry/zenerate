# Paid Tier

**Status:** Not started. Scoped for a future session (rewritten 2026-10-22; Anthropic costs measured in ship 47)
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
- **Anthropic (measured, ship 47):** the studio runs `claude-sonnet-5` at $2 / $10 per MTok
  (input / output), with low-effort thinking and the tools and system prompt prompt-cached.
  Real usage from `scripts/measure-studio-rewrites.ts`, median per turn, warm cache:

  | Turn | Sonnet 5 (today) | Sonnet 5.5 | Haiku 5.5 |
  |---|---|---|---|
  | First draft | $0.018 | $0.021 | $0.0015 |
  | Revision | $0.037 | $0.023 | $0.0014 |
  | "Make the audio", then the card's continuation | $0.008 | $0.009 | $0.0007 |
  | A decline (off-topic request) | $0.0014 | $0.0014 | $0.0001 |
  | **Meditation: draft, two revisions, audio** | **about $0.10** | **about $0.08** | **about $0.005** |

  The first turn after five idle minutes also writes the cache, about 4.4k tokens: +$0.011 on
  Sonnet, +$0.0005 on Haiku. The route now logs a `[chat] usage` line per turn (tokens and
  dollars), so production numbers can replace these.
- **Total: about $0.25–0.30 per finished meditation** on Sonnet, nearly all of it ElevenLabs.
  Stripe takes 2.9% + $0.30 per charge, so **a $5/month plan nets about $4.55, which covers
  roughly 15 meditations a month** before fixed costs. On Haiku 5.5 the Anthropic share drops to
  half a cent, so a free tier costs about what its renders cost.

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
  At about $0.02–0.04 per writing turn on Sonnet (measured, ship 47), one determined free
  user could spend around **$4–7 a day** of Anthropic; on Haiku 5.5, about $0.30. A free-tier
  ceiling of about 30 a day still allows several meditations. Consider a lower free value,
  or a per-user monthly token budget.
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

- Measure first. The route logs `[chat] usage` per turn (ship 47); for per-user budgets, store
  the same numbers in a small usage table per chat turn. `generation_meta.tts_characters`
  already records ElevenLabs usage per render.
- Webhook endpoints verify signatures. The plan lives in a server-written column.
