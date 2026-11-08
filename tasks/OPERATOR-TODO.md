# Operator TODO

Everything left before signups open that only the operator can do: a phone, a dashboard, an
account, or a judgment call. Agents keep this file current. When you finish an item, tick it
and add the date, or tell an agent and it will. Each item names the task file with the detail.

Last updated: 2026-11-08. Sections are in the order to do them. Live sandbox snapshot: `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`.

## 1. Protect the spend (do first)

- [x] 2026-11-06: Anthropic auto-reload **on** with a **$50 monthly spend limit**. The
      balance never runs dry, and the limit blocks requests until the next billing cycle;
      at the launch caps expected spend is a few dollars, so hitting $50 is itself the
      abuse signal. The measurement scripts and seeding draw on the same workspace.
      The original item, for the record: set a monthly spend limit and auto-reload. The account ran dry once during
      agent test runs on 2026-10-21, and seeding runs about 24 agent chats. Consider a
      separate key for dev/testing, so test runs can't take production down.
      **2026-10-30:** the pre-launch audit found the daily chat ceiling and the render
      caps can both be bypassed by a signed-in user until ship task 58 merges, so this
      limit is the only real bound on what one account can spend. Set it before seeding
      resumes, not just before signups.
      **2026-10-31:** at the launch caps (3 renders a month, 30 chat turns a day, 25 renders
      globally) the Anthropic share is a few dollars a month; **$25 a month** leaves room.
      The cost model is in `tasks/post-ship/paid-tier.md`.
- [x] 2026-11-06: ElevenLabs → Subscription: auto top-up (usage-based billing) is **off**,
      so the plan's 30k credits are the hard stop rather than an open-ended bill.
- [x] 2026-11-06: ElevenLabs → usage notifications: one at **80%** (24k credits). The global cap of 25
      renders uses about 23k, and the exempt operator accounts (`QUOTA_EXEMPT_USER_IDS`)
      are not counted by that cap, so this is the only warning that your own renders
      are eating the headroom. Set it lower if you render a lot yourself.

## 2. Quick dashboard items

- [x] 2026-11-08: `privacy@zeneratestudio.com` forwards. ImprovMX, one alias (`privacy`,
      no catch-all), free plan, forwarding only. The apex MX (`mx1`/`mx2.improvmx.com`) and
      SPF (`v=spf1 include:spf.improvmx.com ~all`) are in Vercel DNS and resolve publicly;
      a test mail from another account arrived. `/privacy` and `/terms` (15, 38) and the
      Report link (53) all point here. Replies go out from the operator's own address;
      Resend's SMTP relay would let Gmail send as privacy@ if that ever matters.
- [x] 2026-11-08: DMARC record added: `_dmarc.zeneratestudio.com` TXT `v=DMARC1; p=none;
      rua=mailto:privacy@zeneratestudio.com`, resolving publicly. Gmail and Yahoo demote
      mail from domains without one, which is where the sign-in codes go. Aggregate
      reports (daily XML from each big mailbox provider) land in the privacy inbox; move
      `rua` to a separate alias if they get noisy.
- [ ] Remove the old `PER_USER_MONTHLY_SCRIPT_LIMIT` and `MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS`
      from Vercel. Nothing reads them since 29.
- [ ] Supabase → Auth → URL Configuration: `https://www.zeneratestudio.com/auth/callback**`
      is in Redirect URLs, then run a full password reset with your own account (11).

### Sentry error tracking (51)

The code is merged and does nothing until the DSN is set. **2026-11-06: the production
bundle carries the DSN**, so the project exists and the deploy has it; what is left is
the Sentry-side settings and the checks below. Either take the Vercel Marketplace
route (Vercel → Integrations → Sentry, which makes the account and project and links them;
afterwards check which of the four variables below it set and add the rest), or by hand:

- [x] 2026-11-06 (seen from the bundle): sign up at sentry.io (the free Developer plan is
      enough) and create a **Next.js** project. Copy its DSN (Project Settings → Client Keys).
- [ ] Settings → Auth Tokens → create an Organization Auth Token, for source map uploads.
- [ ] Vercel → Settings → Environment Variables, for Production and Preview:
      `NEXT_PUBLIC_SENTRY_DSN` (the DSN), `SENTRY_AUTH_TOKEN` (mark it sensitive),
      `SENTRY_ORG` and `SENTRY_PROJECT` (the slugs in the project's URL). Redeploy.
      2026-11-06: the DSN is deployed; confirm the other three, which the source map
      upload needs.
- [ ] Sentry project → Settings → Security & Privacy: turn on **Prevent Storing of IP
      Addresses** and leave the Data Scrubber on. `/privacy` says reports carry no IP address.
- [ ] Alerts: keep the default new-issue email, and add an issue alert for **more than 5
      users affected in an hour**.
- [ ] Check: the deploy's build log shows the source map upload. The first real report
      should have a readable stack trace and a user id, and no email or message text.

### Google sign-in (57)

Needed before the Google button works in production; the emailed code needs only the
email steps. 2026-10-30, and again 2026-11-06: production's auth settings list only the
email provider. Do the email steps **before task 57 merges**: until they are done, production
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

- [x] 2026-11-06: Make the house meditations through the studio: about 24, at least 3 per Discover
      category (`DISCOVER_CATEGORIES` in `src/lib/meditation/tags.ts`). Ambience is live, so
      pick beds as you go.
- [x] 2026-11-06: Make public the ones you'd show a stranger. Keep tests and anything personal private.
- [x] 2026-11-06: Mark 6–8 of the best as house picks. Until then Popular and Picked for you stay hidden
      on Discover, and the landing page shows the newest instead:
      `update public.meditations set is_featured = true where id in ('…');`
- [x] 2026-11-06: Note anything the agent did badly while seeding (unneeded questions, a missed length,
      wrong tags) and file it as an issue.

## 4. Phone checks (iPhone: Safari and the installed app)

While seeding:

- [x] 2026-11-06: Studio: tap the input. The composer rides just above the keyboard with the conversation
      visible. No sideways scroll after audio appears in the chat (39).
- [x] 2026-11-06: A sound preview and an ambience preview play (34, 40).
- [x] 2026-11-06: Landing page: swiping over the demo card still scrolls the page (46).
- [x] 2026-11-06: Tag remove buttons on a meditation page are easy to tap (33).

After the redesign merges (these replace the old 35, 42 and 43 checks):

- [x] 2026-11-06: Library rows (48, 55): tapping anywhere on a row, cover included, opens the
      meditation's page; long titles end in "…".
- [x] 2026-11-06: Library and Discover rows, covers and category tiles, in both themes (48, 49).
- [x] 2026-11-06: The Collections tab artwork, a collection page and a meditation page's tag line;
      a dropdown (the Discover tag filter) shows its groups clearly (54, #89).
- [x] 2026-11-06: Studio: "Make the audio" and "Change something", whether "Change something"
      raises the keyboard, and Make audio staying at full strength while it starts (50).
- [x] 2026-11-06: Meditation page and session player (55), in Safari and the installed app: Play opens
      the full-screen session; play, pause, both 15s skips and dragging along the waveform
      work; the chevron minimizes while the audio plays on, and Play ("Playing · … left")
      reopens it at the right place. Lock the phone with the session open: the lock screen
      shows the title, artwork and controls, and they work. "Show script" in the session's
      "…" opens the script on the page, following the audio.
- [x] 2026-11-06: Studio audio card (56): when it appears the whole card is on screen with the voice
      row visible; Listen plays each voice and bed through the speaker, the playing one says
      Stop, and starting another stops it; Change opens the list and Done folds it. After
      one render, the next card says "Same as last time" on the voice and background you
      used. The meditation page's Generate Audio panel has the same rows.
- [x] 2026-11-06: Sign-in (57), in Safari **and the installed app**, signed out: Continue with Google
      lands you in your Library inside the same app, not in Safari; Continue with email
      sends a code that iOS offers above the keyboard, and typing it signs you in.
      The Google half waits for the provider: on 2026-11-06 production still lists only
      the email provider (section 2).

## 5. Production checks (after seeding)

- [x] 2026-11-08: revised Listening with the Heart (public, 23 min) in the studio, re-rendered
      it (about a minute), chose Keep. While the render ran, signed-out fetches of the page still
      got the old script and the old audio, with nothing of the draft in the payload; when it
      finished, both switched. Earlier versions shows one entry for the owner and nothing signed
      out (32).
- [x] 2026-11-06: Signed out, `/discover` loads with categories and shelves (36), and the landing page's
      "Hear one first" row shows meditations (45).
- [x] 2026-11-08: Share cards. A public meditation's link pasted into iMessage (desktop) showed
      the large lotus card with the meditation's title and the domain; pasted into Slack, the
      Zenerate name, the meditation's title and its description. Every page carries the same
      `og-image.png`, so the home link was not pasted separately. Facebook's debugger skipped
      (23, 26).

- [ ] 2026-11-08: Share (59, PR #119). In the installed iPhone app, open a public meditation, choose
      Share from the "…" menu, and confirm the native share sheet opens with the title and
      the link.

### Launch security fixes (58, PR #107)

- [x] 2026-10-30: the longest public house meditation (30 min) narrates 2,549 characters and
      the longest script is 3,580, both well under the 6,000-character narration cap (read
      from production as `anon` before the merge).
- [ ] Optional: set `MAX_GLOBAL_DAILY_CHAT_TURNS` in Vercel Production (all accounts' chat
      turns per 24 hours; the code defaults to 2000).
- [x] 2026-10-30, merged as 1fbba5b and checked signed out in production: `GET
      /meditations?select=user_id` (and `audio_path`, `audio_url`, `generation_meta`, `prompt`)
      returns 42501; `discover_meditations` returns the public columns only; `reserve_chat_turn`,
      `reserve_audio_generation` and `chat_turns` are denied to `anon`; `/`, `/discover` and a
      public meditation page load with no private column in the payload and the audio signed;
      the sitemap still lists all 14 public meditations.
- [x] 2026-11-08: **the signed-in half**, run from the operator's own session in the site's
      DevTools console with the publishable key against `https://<project>.supabase.co/rest/v1/`.
      A control GET of the operator's meditation returned 200 with one row. Every write was
      refused with 42501: PATCH of `audio_path`, `status`, `is_featured`, `user_id` and
      `generation_meta` on `meditations`; POST to `meditation_versions`; DELETE and PATCH of
      `role`, `created_at` and `parts` on `chat_messages`. Same list as
      `src/test/launch-security.db.test.ts`, which passed against local Supabase before the merge.
- [x] 2026-11-08: the re-render above was the live make-audio. Make private then Make public
      from the page menu: private returned 404 signed out and left `/discover` at once (the
      sitemap keeps it for up to an hour, as documented); public returned 200 with the new audio
      signed.

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
      backup runbook (10). 2026-10-30: the route answers 401 without its secret, as it
      should; the cron log needs the dashboard.
- [ ] Install the 30-day prune once, on every machine that holds dumps, passing the
      off-site folder if it is a synced folder on this Mac:
      `./scripts/schedule-backup-prune.sh "$HOME/Library/CloudStorage/<drive>/zenerate"`.
      Then check `launchctl print gui/$(id -u)/com.zeneratestudio.backup-prune` shows exit
      code 0 and `~/backups/zenerate/prune.log` is empty (52). Any dump already older than
      29 days is deleted on the first run. 2026-10-30: not installed on this Mac yet, and
      `~/backups/zenerate/` does not exist.
- [ ] Decide the off-site copy: the job cannot empty a cloud drive's trash (Google Drive and
      iCloud keep deleted files 30 days), so either empty it after prunes or use a drive or
      folder with no trash. Copies anywhere else need the job too (52).
- [ ] From now on, each time you delete an account, `touch
      ~/backups/zenerate/deletions/<user-id>`. A restore re-deletes those accounts; one
      without a record comes back (52, runbook "Deletion records").

## 7. Optional

- [ ] Enable the Sound Effects permission on an ElevenLabs key, if you ever want generated
      ambience candidates (44).
- [x] 2026-10-30: every `.env.local` on this Mac (the primary checkout and the one remaining
      worktree) names the live snapshot `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`.

## 8. Open signups (task 38)

- [ ] Everything above is ticked, and ship tasks 48–57 are merged (they are, as of
      2026-10-26; nothing is open).
- [x] 2026-10-30: ship task 58 (launch security fixes) merged (PR #107) and its signed-out
      production checks pass; the signed-in checks and one live render are in section 5.
- [x] 2026-10-31: free tier decided for launch (`tasks/post-ship/paid-tier.md`): free with
      the current caps and no billing yet; open to 20–30 accounts, measure for a month,
      then price. The daily chat ceiling's code default is now 30 turns (was 200).
- [ ] Vercel → Settings → Environment Variables: confirm `PER_USER_DAILY_CHAT_MESSAGES` is
      **not** set in Production (ship 29 said to set it only to override 200), or set it
      to 30. If it is set to 200 there, the new code default never applies.
- [ ] Supabase → Reports: write down the storage and egress figures on the day signups open.
      Every meditation page view downloads the whole audio file (22 MB for 15 minutes), so
      the free plan's 5 GB of egress is about 230 views a month; the fix is
      `tasks/post-ship/audio-egress.md`.
- [x] 2026-11-06: Supabase → Authentication → Rate Limits: raise **emails per hour** from 25 to about
      100. Every email sign-in now sends a code (57), so 25 an hour runs out on a busy day.
      Check Resend's plan limits too: the free plan allows 100 a day and 3,000 a month.
- [ ] Supabase → Auth → enable signups.

## Done

- 2026-10-30: pre-launch audit's production checks, as `anon` with the public key: every
  private table (chats, messages, drafts, versions, plays, favorites, collections, events)
  and the audio bucket refuse; public rows carry no prompt text and no audio URL; the
  sitemap lists exactly the 14 public meditations; signups are off and email confirmation
  is on. Code findings are ship task 58.
- 2026-10-22: studio agent switched to `claude-sonnet-5-5` (`STUDIO_MODEL` in Vercel Production and Preview), after reading the comparison scripts (47).
- 2026-10-22: ambience snapshot live and verified by ear in production (40, 44).
- 2026-10-21: operator data wiped (28); `QUOTA_EXEMPT_USER_IDS` set (31);
  `NEXT_PUBLIC_SITE_URL` set (09); auth email templates pasted (08); Mac Now Playing (25).
