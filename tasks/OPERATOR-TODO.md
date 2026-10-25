# Operator TODO

Everything left before signups open that only the operator can do: a phone, a dashboard, an
account, or a judgment call. Agents keep this file current. When you finish an item, tick it
and add the date, or tell an agent and it will. Each item names the task file with the detail.

Last updated: 2026-10-25. Sections are in the order to do them. Live sandbox snapshot: `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`.

## 1. Protect the spend (do first)

- [ ] Anthropic: set a monthly spend limit and auto-reload. The account ran dry once during
      agent test runs on 2026-10-21, and seeding runs about 24 agent chats. Consider a
      separate key for dev/testing, so test runs can't take production down.

## 2. Quick dashboard items

- [ ] Set up the `privacy@zeneratestudio.com` forwarder. `/privacy` tells people to email it
      (15, 38), and the Report link (53) will too.
- [ ] Remove the old `PER_USER_MONTHLY_SCRIPT_LIMIT` and `MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS`
      from Vercel. Nothing reads them since 29.
- [ ] Supabase → Auth → URL Configuration: `https://www.zeneratestudio.com/auth/callback**`
      is in Redirect URLs, then run a full password reset with your own account (11).

### Sentry error tracking (51)

The code is merged and does nothing until the DSN is set. Either take the Vercel Marketplace
route (Vercel → Integrations → Sentry, which makes the account and project and links them;
afterwards check which of the four variables below it set and add the rest), or by hand:

- [ ] Sign up at sentry.io (the free Developer plan is enough) and create a **Next.js**
      project. Copy its DSN (Project Settings → Client Keys).
- [ ] Settings → Auth Tokens → create an Organization Auth Token, for source map uploads.
- [ ] Vercel → Settings → Environment Variables, for Production and Preview:
      `NEXT_PUBLIC_SENTRY_DSN` (the DSN), `SENTRY_AUTH_TOKEN` (mark it sensitive),
      `SENTRY_ORG` and `SENTRY_PROJECT` (the slugs in the project's URL). Redeploy.
- [ ] Sentry project → Settings → Security & Privacy: turn on **Prevent Storing of IP
      Addresses** and leave the Data Scrubber on. `/privacy` says reports carry no IP address.
- [ ] Alerts: keep the default new-issue email, and add an issue alert for **more than 5
      users affected in an hour**.
- [ ] Check: the deploy's build log shows the source map upload. The first real report
      should have a readable stack trace and a user id, and no email or message text.

### Google sign-in (57)

Needed before the Google button works in production; the emailed code needs only the
email steps. Do the email steps **before task 57 merges**: until they are done, production
mails a link where the new `/login` asks for a code. Until Google is on, the button says
"Google sign-in isn't available right now" and nothing breaks.

- [ ] Google Cloud Console → a new project → **OAuth consent screen**: External, app name
      Zenerate, support email, the `zeneratestudio.com` domain, links to `/privacy` and
      `/terms`. Scopes: the defaults only (email, profile, openid), so no app review. Publish
      it to Production, or only test users can sign in. A logo triggers brand verification
      (a few days); leave it off unless you want to wait.
- [ ] **Credentials** → Create OAuth client ID → Web application. Authorized redirect URI:
      `https://xnvqjqobegcpkigkmoct.supabase.co/auth/v1/callback` (Supabase shows the exact
      one on the Google provider page). For local testing, a second client with
      `http://127.0.0.1:54321/auth/v1/callback` (`.env.example` says how to use it locally).
- [ ] Supabase → Authentication → Sign In / Providers → **Google**: on, with the client ID
      and secret.
- [x] 2026-10-25: Supabase → Authentication → Emails: paste the **Magic Link** template from
      `supabase/templates/magic_link.html` with the subject "Your Zenerate sign-in code", and
      replace **Confirm signup** with `confirmation.html`, subject "Your Zenerate sign-up
      code". Both now show a 6-digit code and no link; a password sign-up confirms with the
      code too.
- [x] 2026-10-25: Supabase → Authentication → Sign In / Providers → **Email**: Email OTP
      Length **6** and Email OTP Expiration **3600**. `/login` and the emails say six digits and an hour.
- [ ] Know that Google's consent screen will say "continue to xnvqjqobegcpkigkmoct.supabase.co"
      unless you buy Supabase's custom domain add-on. It works either way.

## 3. Seed Discover on your iPhone (task 37)

Seeding is independent of the redesign (48–50), so it can start now. Do it on the phone and
tick the studio checks in section 4 as you go.

- [ ] Make the house meditations through the studio: about 24, at least 3 per Discover
      category (`DISCOVER_CATEGORIES` in `src/lib/meditation/tags.ts`). Ambience is live, so
      pick beds as you go.
- [ ] Make public the ones you'd show a stranger. Keep tests and anything personal private.
- [ ] Mark 6–8 of the best as house picks. Until then Popular and Picked for you stay hidden
      on Discover, and the landing page shows the newest instead:
      `update public.meditations set is_featured = true where id in ('…');`
- [ ] Note anything the agent did badly while seeding (unneeded questions, a missed length,
      wrong tags) and file it as an issue.

## 4. Phone checks (iPhone: Safari and the installed app)

While seeding:

- [ ] Studio: tap the input. The composer rides just above the keyboard with the conversation
      visible. No sideways scroll after audio appears in the chat (39).
- [ ] A sound preview and an ambience preview play (34, 40).
- [ ] Landing page: swiping over the demo card still scrolls the page (46).
- [ ] Tag remove buttons on a meditation page are easy to tap (33).

After the redesign merges (these replace the old 35, 42 and 43 checks):

- [ ] Library rows (48, 55): tapping anywhere on a row, cover included, opens the
      meditation's page; long titles end in "…".
- [ ] Library and Discover rows, covers and category tiles, in both themes (48, 49).
- [ ] The Collections tab artwork, a collection page and a meditation page's tag line;
      a dropdown (the Discover tag filter) shows its groups clearly (54, #89).
- [ ] Studio: "Make the audio" and "Change something", whether "Change something"
      raises the keyboard, and Make audio staying at full strength while it starts (50).
- [ ] Meditation page and session player (55), in Safari and the installed app: Play opens
      the full-screen session; play, pause, both 15s skips and dragging along the waveform
      work; the chevron minimizes while the audio plays on, and Play ("Playing · … left")
      reopens it at the right place. Lock the phone with the session open: the lock screen
      shows the title, artwork and controls, and they work. "Show script" in the session's
      "…" opens the script on the page, following the audio.
- [ ] Studio audio card (56): when it appears the whole card is on screen with the voice
      row visible; Listen plays each voice and bed through the speaker, the playing one says
      Stop, and starting another stops it; Change opens the list and Done folds it. After
      one render, the next card says "Same as last time" on the voice and background you
      used. The meditation page's Generate Audio panel has the same rows.
- [ ] Sign-in (57), in Safari **and the installed app**, signed out: Continue with Google
      lands you in your Library inside the same app, not in Safari; Continue with email
      sends a code that iOS offers above the keyboard, and typing it signs you in.

## 5. Production checks (after seeding)

- [ ] Revise a meditation that already has audio, re-render it, and choose keep or replace. Earlier versions should appear for you only (32).
- [ ] Signed out, `/discover` loads with categories and shelves (36), and the landing page's
      "Hear one first" row shows meditations (45).
- [ ] Share cards: paste `https://www.zeneratestudio.com/` and one public meditation into two
      of iMessage, Slack, X and Discord. Each shows a large card with the lotus or the
      meditation's title and description. Optionally run Facebook's Sharing Debugger (23, 26).

### When a report arrives (53)

A Report link mails `privacy@` with the meditation's title and URL. If it breaks the terms,
unlist it in the Supabase SQL editor (production), using the id at the end of the URL:

```sql
update public.meditations set is_public = false, is_featured = false where id = '…';
```

It leaves `/discover` and its page at once; the sitemap drops it within the hour. The owner
can make it public again from the "…" menu, so email them, and delete the meditation or the
account (`/terms`, "Be decent") if it comes back.

## 6. Backups

- [ ] Confirm the keepalive cron in Vercel's cron log, and take one production dump with the
      backup runbook (10).
- [ ] Install the 30-day prune once, on every machine that holds dumps, passing the
      off-site folder if it is a synced folder on this Mac:
      `./scripts/schedule-backup-prune.sh "$HOME/Library/CloudStorage/<drive>/zenerate"`.
      Then check `launchctl print gui/$(id -u)/com.zeneratestudio.backup-prune` shows exit
      code 0 and `~/backups/zenerate/prune.log` is empty (52). Any dump already older than
      29 days is deleted on the first run.
- [ ] Decide the off-site copy: the job cannot empty a cloud drive's trash (Google Drive and
      iCloud keep deleted files 30 days), so either empty it after prunes or use a drive or
      folder with no trash. Copies anywhere else need the job too (52).
- [ ] From now on, each time you delete an account, `touch
      ~/backups/zenerate/deletions/<user-id>`. A restore re-deletes those accounts; one
      without a record comes back (52, runbook "Deletion records").

## 7. Optional

- [ ] Enable the Sound Effects permission on an ElevenLabs key, if you ever want generated
      ambience candidates (44).
- [ ] Other worktrees' `.env.local` copies still name a deleted snapshot. The live one is
      `AUDIO_SANDBOX_SNAPSHOT_ID=snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`. Only local renders care.

## 8. Open signups (task 38)

- [ ] Everything above is ticked, and ship tasks 48–57 are merged.
- [ ] Decide the free tier first: see `tasks/post-ship/paid-tier.md`. At minimum lower the
      daily chat ceiling (200 messages a day is a lot of Anthropic spend per user).
- [ ] Supabase → Authentication → Rate Limits: raise **emails per hour** from 25 to about
      100. Every email sign-in now sends a code (57), so 25 an hour runs out on a busy day.
      Check Resend's plan limits too: the free plan allows 100 a day and 3,000 a month.
- [ ] Supabase → Auth → enable signups.

## Done

- 2026-10-22: studio agent switched to `claude-sonnet-5-5` (`STUDIO_MODEL` in Vercel Production and Preview), after reading the comparison scripts (47).
- 2026-10-22: ambience snapshot live and verified by ear in production (40, 44).
- 2026-10-21: operator data wiped (28); `QUOTA_EXEMPT_USER_IDS` set (31);
  `NEXT_PUBLIC_SITE_URL` set (09); auth email templates pasted (08); Mac Now Playing (25).
