# Operator TODO

Everything left before signups open that only the operator can do: a phone, a dashboard, an
account, or a judgment call. Agents keep this file current. When you finish an item, tick it
and add the date, or tell an agent and it will. Each item names the task file with the detail.

Last updated: 2026-10-22. Live sandbox snapshot: `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`.

## 1. Seed Discover (task 37)

- [ ] Make the house meditations through the studio: about 24, at least 3 per Discover
      category (`DISCOVER_CATEGORIES` in `src/lib/meditation/tags.ts`). Ambience is live, so
      pick beds as you go.
- [ ] Make public the ones you'd show a stranger. Keep tests and anything personal private.
- [ ] Mark 6–8 of the best as house picks. Until then Popular and Picked for you stay hidden
      on Discover, and the landing page shows the newest instead:
      `update public.meditations set is_featured = true where id in ('…');`
- [ ] Note anything the agent did badly while seeding (unneeded questions, a missed length,
      wrong tags) and file it as an issue.

## 2. Phone checks (iPhone: Safari and the installed app)

- [ ] Studio: tap the input. The composer rides just above the keyboard with the conversation
      visible. No sideways scroll after audio appears in the chat (39).
- [ ] Studio: the "Make the audio" and "Change something" chips; check whether "Change
      something" raises the keyboard (43).
- [ ] Covers on Discover and in the Library, in both themes (35, 42).
- [ ] Tag remove buttons on a meditation page are easy to tap (33).
- [ ] A sound preview and an ambience preview play (34, 40).
- [ ] Landing page: swiping over the demo card still scrolls the page (46).

## 3. Production checks

- [ ] Revise a meditation that already has audio, re-render it, and choose keep or replace. Earlier versions should appear for you only (32).
- [ ] Supabase → Auth → URL Configuration: `https://www.zeneratestudio.com/auth/callback**`
      is in Redirect URLs, then run a full password reset with your own account (11).
- [ ] Signed out, `/discover` loads with categories and shelves (36), and the landing page's
      "Hear one first" row shows meditations (45).
- [ ] Share cards: paste `https://www.zeneratestudio.com/` and one public meditation into two
      of iMessage, Slack, X and Discord. Each shows a large card with the lotus or the
      meditation's title and description. Optionally run Facebook's Sharing Debugger (23, 26).

## 4. Accounts and config

- [ ] Set up the `privacy@zeneratestudio.com` forwarder. `/privacy` tells people to email it
      (15, 38).
- [ ] Confirm the keepalive cron in Vercel's cron log, and take one production dump with the
      backup runbook (10).
- [ ] Remove the old `PER_USER_MONTHLY_SCRIPT_LIMIT` and `MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS`
      from Vercel. Nothing reads them since 29.
- [ ] Anthropic: set a monthly spend limit and auto-reload. The account ran dry once during
      agent test runs on 2026-10-21. Consider a separate key for dev/testing, so test runs
      can't take production down.
- [ ] Optional: enable the Sound Effects permission on an ElevenLabs key, if you ever want
      generated ambience candidates (44).
- [ ] Optional: other worktrees' `.env.local` copies still name a deleted snapshot. The live
      one is `AUDIO_SANDBOX_SNAPSHOT_ID=snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`. Only local renders
      care.

## 5. Open signups (task 38)

- [ ] Everything above is ticked.
- [ ] Decide the free tier first: see `tasks/post-ship/paid-tier.md`, especially the daily chat
      ceiling (200 messages a day is a lot of Anthropic spend per user).
- [ ] Supabase → Auth → enable signups.

## Done

- 2026-10-22: studio agent switched to `claude-sonnet-5-5` (`STUDIO_MODEL` in Vercel Production and Preview), after reading the comparison scripts (47).
- 2026-10-22: ambience snapshot live and verified by ear in production (40, 44).
- 2026-10-21: operator data wiped (28); `QUOTA_EXEMPT_USER_IDS` set (31);
  `NEXT_PUBLIC_SITE_URL` set (09); auth email templates pasted (08); Mac Now Playing (25).
