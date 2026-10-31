# Paid Tier

**Status:** Not started. **Decision for launch (2026-10-31): free with the current caps, no
billing yet.** Open signups to 20–30 accounts, measure for a month with the queries below,
then price. Build billing when about ten people would pay, or when ElevenLabs Creator
becomes necessary; the two arrive together.
**Priority:** Post-ship. The pre-rollout parts (the chat ceiling, the spend limit, the
measurements) are done or sit in `tasks/OPERATOR-TODO.md` sections 1 and 8.

## Why it matters

The operator: "I feel my Claude credits and ElevenLabs credits wouldn't last long if actual
people started signing up." Right, and the studio made each meditation a conversation, so
Anthropic spend now lives in chat turns as well as renders. The question before rollout was
whether that forces a price from day one. It does not: the caps already bound the exposure,
and the number a price depends on (cost per active user) is unknown until people use it.

## What a meditation costs us (2026-10-31)

Sonnet 5.5 in the studio, ElevenLabs Starter with `eleven_multilingual_v2` at one credit a
character, Vercel Hobby, Supabase Free.

| Component | Per finished meditation | Basis |
|---|---|---|
| ElevenLabs narration | $0.16–0.40, typically about $0.24 | 800–2,000 speech characters at $0.0002 a credit (Starter, $6 for 30k). Seeded scripts measure about 840; the prompt asks for 1–4 minutes of speech whatever the length. Task 58's 6,000-character render bound caps one render at $1.20. Creator ($22 for 121k) brings a credit to $0.00018 |
| Anthropic, `claude-sonnet-5-5` | about $0.05–0.08 | Measured in ship 47, warm cache: draft $0.021, revision $0.023, the audio turn and its continuation $0.009, a decline $0.0014. The first turn after five idle minutes writes the cache, +$0.011. Haiku 5.5 would be about $0.005 |
| Vercel Sandbox | about $0 on Hobby | 5 free Active-CPU-hours a month is about 300 renders. On Pro, $0.128 an hour, about half a cent a render |
| Supabase storage | 1.44 MB a minute of audio | The final mix is 192 kbps MP3: a 15-minute meditation is 22.4 MB (measured in production, `audio-egress.md`) |

**About $0.30 a meditation, 80% of it ElevenLabs.** A free user at the cap (3 renders, with
the chat that produced them) costs about $1 a month; a typical user who renders once, about
$0.35. Stripe takes 2.9% + $0.30 a charge, so a $5 plan nets $4.55.

## Where the current plans run out

| Limit | Binds at |
|---|---|
| ElevenLabs Starter, 30k credits (the global cap of 25 renders) | about 8 users at the free cap, 15–20 typical users |
| Supabase Free, 1 GB of storage | about 45 stored 15-minute meditations, 70 ten-minute ones |
| Supabase Free, 5 GB of egress a month | about 230 meditation page views of a 15-minute file. **A view, not a listen:** the player downloads the whole file on mount, and a fresh signed URL defeats the browser cache (`audio-egress.md`, measured 2026-10-31) |
| Vercel Hobby, 5 Sandbox CPU-hours | about 300 renders a month, then renders pause |
| Anthropic | not a limit: 25 renders is about $2 a month. The chat ceilings and the spend limit cover the worst case |

ElevenLabs is the expected ceiling, and Creator ($22, about 100 renders) the next step. The
surprise is Supabase: storage and egress run out at about the same time as Starter, so Pro
($25) arrives early unless `audio-egress.md` lands first (precomputed peaks so the player
streams, then a lower bitrate; each roughly halves the egress figure).

## What the numbers say about $5 a month

A $5 plan nets $4.55. At $0.30 a render, a user who uses a 15-render cap leaves nothing; a
10-render cap leaves about $1.50. On Creator or Pro a render is $0.20–0.22, and Flash v2.5
at half a credit a character would roughly halve narration cost, with a quality trade-off to
hear first. Once you charge, the fixed floor is about $50–70 a month (Vercel Pro $20, since
Hobby prohibits commercial use; Supabase Pro $25; ElevenLabs), so break-even is 12–15 paying
users.

So $5 a month works on unit economics with a 10-render cap, or $8 for 20, plus a $48 annual
option. Decide it after a month of real numbers, not before.

## Before signups (what the decision changed)

- **The daily chat ceiling's code default is 30 turns** (`PER_USER_DAILY_CHAT_MESSAGES`, was
  200; 2026-10-31). A meditation is about five turns, so 30 is about six meditations' worth
  of chat a day. One account's Anthropic exposure drops from about $7 a day to about $1 in
  practice, $12 at the theoretical worst case. The operator confirms Vercel Production does
  not override it (operator TODO, section 8).
- **Free renders stay at 3 a month per user**, the global cap at 25. When the global cap is
  hit everyone waits until next month, which is safe and, at 20–30 accounts, tolerable.
- **The Anthropic spend limit** (operator TODO, section 1): about $25 a month covers the
  launch caps with room. Confirm ElevenLabs usage-based overage is off, so the plan's credits
  are the hard stop.
- **Open to 20–30 accounts** and read the numbers after a month.

## Measuring: what is already stored, and how to read it

Every chat turn is a row in `chat_turns` (service-role only, task 58). Every render is a row
in `audio_generation_events`, and the rendered row keeps its ElevenLabs character count in
`generation_meta.tts_characters` (the current version on `meditations`, archived ones on
`meditation_versions`). Counted plays (30 s, signed in) are in `meditation_plays`. The chat
route also logs a `[chat] usage` line per turn with tokens and dollars (ship 47); those are
in the Vercel logs, not the database, so the first query prices turns at the measured
median.

Run both in the Supabase SQL editor (it runs as `postgres`, so RLS does not apply).

**Cost per account, last 30 days:**

```sql
with turns as (
  select user_id, count(*) as turns
  from public.chat_turns
  where created_at > now() - interval '30 days'
  group by user_id
),
renders as (
  select user_id, count(*) as renders
  from public.audio_generation_events
  where status = 'completed' and created_at > now() - interval '30 days'
  group by user_id
),
chars as (
  -- Each account's average narration length, from every render it has kept.
  -- Drafts not yet promoted are not counted.
  select m.user_id, avg((g.generation_meta->>'tts_characters')::int) as avg_chars
  from (
    select id as meditation_id, generation_meta from public.meditations
    union all
    select meditation_id, generation_meta from public.meditation_versions
  ) g
  join public.meditations m on m.id = g.meditation_id
  where g.generation_meta ? 'tts_characters'
  group by m.user_id
)
select u.email,
       coalesce(t.turns, 0)   as turns_30d,
       coalesce(r.renders, 0) as renders_30d,
       round(coalesce(c.avg_chars, 930)) as avg_chars_per_render,
       -- $0.03 a turn (ship 47 median on Sonnet 5.5), $0.0002 an ElevenLabs credit
       round((coalesce(t.turns, 0) * 0.03
            + coalesce(r.renders, 0) * coalesce(c.avg_chars, 930) * 0.0002)::numeric, 2)
         as est_usd_30d
from auth.users u
left join turns t on t.user_id = u.id
left join renders r on r.user_id = u.id
left join chars c on c.user_id = u.id
order by est_usd_30d desc, u.email;
```

**This month against the plan limits:**

```sql
select
  (select count(*) from public.audio_generation_events
    where status = 'completed'
      and created_at >= date_trunc('month', now()))                 as renders,          -- global cap 25
  (select count(*) from public.chat_turns
    where created_at >= date_trunc('month', now()))                 as chat_turns,
  (select count(distinct user_id) from public.chat_turns
    where created_at >= date_trunc('month', now()))                 as active_accounts,
  (select count(*) from public.meditation_plays
    where played_at >= date_trunc('month', now()))                  as counted_plays,
  (select count(*) from storage.objects
    where bucket_id = 'meditation-audio')                           as audio_files,
  (select pg_size_pretty(sum((metadata->>'size')::bigint))
    from storage.objects where bucket_id = 'meditation-audio')      as audio_stored;     -- 1 GB free
```

ElevenLabs credits used and Supabase egress are read from those two dashboards; neither is
in the database. Page views are not recorded anywhere, so egress divided by the typical file
size is the only view count.

## Scope sketch (when billing is built)

- **Plans.** One paid plan, for example **Plus at $5/month**: about 10 renders a month, a
  higher chat ceiling, every voice and ambience. Free stays at 3 renders and the 30-turn
  ceiling. Annual pricing (for example $48/year) is cheap to add with Stripe.
- **Billing.** Two options:
  - **Stripe Checkout + Customer Portal + webhooks** to a `subscriptions` table (or a tier
    column), never trusting the client. Log raw events to `stripe_events` for replay.
  - **Lemon Squeezy or Paddle**, if you'd rather they act as merchant of record and handle
    international VAT and sales tax. They cost more per sale but there's no tax work.
- **The quota layer reads the plan.** `src/lib/audio/quota.ts` already takes a per-user cap
  and has the exemption path (`QUOTA_EXEMPT_USER_IDS`); `src/lib/ai/quota.ts` reads the chat
  ceiling from the environment. Both become lookups by plan.
- **Per-turn usage in the ledger.** `reserve_chat_turn` could return the row id and the
  route update it with the `[chat] usage` figures (model, tokens, cost) when the turn ends.
  Then the first query prices turns exactly, and a per-user monthly token budget is a sum.
- **Upgrade prompts in the studio.** When a free user hits a limit, the audio card or the
  chat says so and offers the upgrade inline. The audio card already shows "renders left".
- **Account page.** Billing lives with the profile and settings work
  (`tasks/post-ship/user-profiles.md`, `/account`).
- **Legal.** `/terms` needs billing and refund terms; `/privacy` needs the payment processor.
- **Hosting.** Vercel Pro ($20) the day the first charge goes through; Supabase Pro when
  storage or egress say so.

## Decisions to make

- **Free tier or trial?** Free with 3 renders is the launch decision. A 7-day trial then
  paid-only remains the alternative if free users cost more than the measurements predict.
- **What counts toward the cap:** renders only (as today) or also writing turns? Renders only
  is simpler to explain; the chat ceiling handles chat cost.
- **Failed renders:** the free retry (ship 03) carries over unchanged.
- **Cancel mid-month:** access to the end of the period, then the free tier.
- **Custom voices** (ElevenLabs cloning) as a higher tier later. That needs a moderation story.

## Implementation notes

- Webhook endpoints verify signatures. The plan lives in a server-written column.
- Plan figures as of 2026-10-31, from the vendors' pricing pages: ElevenLabs Starter $6 for
  30k credits, Creator $22 for 121k, Pro $99 for 600k; Vercel Hobby 5 Sandbox
  Active-CPU-hours a month and non-commercial only, Pro $20 plus $0.128 a CPU-hour;
  Supabase Free 500 MB database, 1 GB storage, 5 GB egress, Pro $25 with 100 GB storage and
  250 GB egress, about $0.09 a GB beyond.
