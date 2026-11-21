# Operator TODO

Everything left before signups open that only the operator can do: a phone, a dashboard, an
account, or a judgment call. Agents keep this file current. When you finish an item, tick it
and add the date, or tell an agent and it will. Each item names the task file with the detail.

Last updated: 2026-11-21. Sections are in the order to do them. Live sandbox snapshot: `snap_sXOy59qkIhIo95G7Y9N33oAaAPMY` (2026-11-16, task 60: peaks, 128 kbps), the only one; the two before it were deleted once it had rendered in production.

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
- [x] 2026-11-08: the old `PER_USER_MONTHLY_SCRIPT_LIMIT` and `MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS`
      are not set in Vercel, Production or Preview (`vercel env pull` of both). Nothing reads
      them since 29.
- [x] 2026-11-16: Supabase → Auth → URL Configuration: `https://www.zeneratestudio.com/auth/callback**`
      is in Redirect URLs, and a full password reset with your own account worked (11).

### Sentry error tracking (51)

**2026-11-08: Sentry is on in production.** Org `keenan-berry-personal`, project `zenerate`.
The four variables are in Vercel for Production and Preview, production was redeployed, the
build log says "Successfully uploaded source maps to Sentry", the served bundles carry the
DSN and Sentry's debug ids and no source-map comments, and an error thrown on the live site
reached the ingest endpoint (200). Until that day nothing was configured: a 2026-11-06 note
claiming the bundle carried the DSN was wrong. Left below: the two Sentry-side settings and
a look at the first real report.

- [x] 2026-11-08: Sentry account on the free plan, Next.js project `zenerate`. The project was
      recreated once during setup, which changes the DSN; the DSN in Vercel is the current
      one (Settings → Projects → zenerate → Client Keys).
- [x] 2026-11-08: Organization Auth Token created and stored in Vercel as a sensitive
      variable. To check such a token, call `/api/0/organizations/<org>/releases/` with it
      (200); `/organizations/<org>/` answers 403 for an org token, which is normal.
- [x] 2026-11-08: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` and
      `SENTRY_AUTH_TOKEN` set for Production and Preview (the first three by an agent with
      `vercel env add NAME --environment production,preview`, the token by the operator from
      the clipboard with `--sensitive`), then `vercel redeploy` of the current production
      deployment.
- [x] 2026-11-16: Sentry project → Settings → Security & Privacy: turn on **Prevent Storing of IP
      Addresses** and leave the Data Scrubber on. `/privacy` says reports carry no IP address.
- [x] 2026-11-16: Alerts: keep the default new-issue email, and add an issue alert for **more than 5
      users affected in an hour**.
- [x] 2026-11-08: the redeploy's build log shows "Successfully uploaded source maps to
      Sentry". Two test events are in the project from that day (an info message and a
      thrown error from injected code); resolve or delete them.
- [ ] The first real report should have a readable stack trace and a user id, and no
      email or message text. The test error came from injected code, so it says nothing
      about source maps.

### Google sign-in (57)

Needed before the Google button works in production; the emailed code needs only the
email steps. 2026-10-30, and again 2026-11-06: production's auth settings list only the
email provider. Do the email steps **before task 57 merges**: until they are done, production
mails a link where the new `/login` asks for a code. Until Google is on, the button says
"Google sign-in isn't available right now" and nothing breaks.

- [x] 2026-11-16: Google Cloud Console → a new project → **OAuth consent screen**: External, app name
      Zenerate, support email, the `zeneratestudio.com` domain, links to `/privacy` and
      `/terms`. Scopes: the defaults only (email, profile, openid), so no app review. Publish
      it to Production, or only test users can sign in. A logo triggers brand verification
      (a few days); leave it off unless you want to wait.
- [x] 2026-11-16: **Credentials** → Create OAuth client ID → Web application. Authorized redirect URI:
      `https://xnvqjqobegcpkigkmoct.supabase.co/auth/v1/callback` (Supabase shows the exact
      one on the Google provider page). For local testing, a second client with
      `http://127.0.0.1:54321/auth/v1/callback` (`.env.example` says how to use it locally).
- [x] 2026-11-16: Supabase → Authentication → Sign In / Providers → **Google**: on, with the client ID
      and secret.
- [x] 2026-10-25: Supabase → Authentication → Emails: paste the **Magic Link** template from
      `supabase/templates/magic_link.html` with the subject "Your Zenerate sign-in code", and
      replace **Confirm signup** with `confirmation.html`, subject "Your Zenerate sign-up
      code". Both now show a 6-digit code and no link; a password sign-up confirms with the
      code too.
- [x] 2026-10-25: Supabase → Authentication → Sign In / Providers → **Email**: Email OTP
      Length **6** and Email OTP Expiration **3600**. `/login` and the emails say six digits and an hour.
- [x] 2026-11-16: Know that Google's consent screen will say "continue to xnvqjqobegcpkigkmoct.supabase.co"
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
      the email provider (section 2). 2026-11-16: production lists `google` and `email`,
      and Continue with Google signs in on the desktop browser and in the installed iPhone
      app. Signups were still off, so the sign-in linked Google to the existing account.

After the app shell's navigation merges (app shell PR 1,
`docs/superpowers/plans/2026-11-21-app-shell-navigation.md`):

- [ ] Installed app on iPhone: the bottom bar (Library, Discover, Create) sits above the
      home indicator; the last row of a long list (Library, Discover) and the footer
      scroll clear of it; in the studio the bar is gone and the back chevron beside the
      chat title returns to Create. The app's start page moved from `/dashboard` to
      `/library` with no redirect: if the installed app opens to "not found", remove it
      from the Home Screen and add it again from Safari.

After the bottom sheets merge (app shell PR 3, same plan):

- [ ] iPhone, in Safari and the installed app: drag a sheet closed by its handle (the
      meditation "…", say), and a short drag springs back; Add tag, Edit collection, and
      New collection inside Add to collection keep the field above the keyboard; "Add to
      collection" from the meditation "…" closes the menu and then opens the collection
      sheet; with the theme on Light, the session player's "…" sheet is dark.
- [ ] iPhone: on Library → Collections, a collection's "…" → Edit collection opens the
      Edit sheet with the keyboard up on Name, and the keyboard stays up (it must not drop
      a moment later as the menu sheet finishes closing).
- [ ] iPhone, after the avatar upload PR merges: on Account, Add photo → pick a photo from the
      library (and once from the camera). The circle shows the middle of the photo and the
      Library header's avatar shows it too. Change photo to a different one, then Remove; each
      time the avatar updates without a reload of your own. Safari cannot encode WebP, so the
      stored file is a JPEG there (`docs/superpowers/specs/2026-11-21-avatar-upload-design.md`).

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

- [x] 2026-11-16: Share (59, PR #119). In the installed iPhone app, open a public meditation, choose
      Share from the "…" menu, and confirm the native share sheet opens with the title and
      the link.

### Launch security fixes (58, PR #107)

- [x] 2026-10-30: the longest public house meditation (30 min) narrates 2,549 characters and
      the longest script is 3,580, both well under the 6,000-character narration cap (read
      from production as `anon` before the merge).
- [x] 2026-11-16: `MAX_GLOBAL_DAILY_CHAT_TURNS` left unset in Vercel Production, so the code
      default of 2000 applies (all accounts' chat turns per 24 hours). At 30 turns per account
      a day it binds only past about 66 accounts at their cap. The operator has set a monthly
      spend limit in the Anthropic Console, which caps the bill directly.
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

### Audio egress (60)

A meditation page now draws its waveform from peaks stored with the render and streams the
audio on play, instead of downloading the whole file on page load
(`tasks/ship/60-audio-egress.md`). Every render made before it was backfilled on
2026-11-16.

- [x] 2026-11-16: iPhone, in Safari **and the installed app**, on any meditation: a tap on Play starts it promptly, the waveform is there
      before you press it, dragging along it and both 15s skips work before and during
      play, and with the phone locked the lock screen shows the title and controls and
      they work (`use-media-session.ts`). The audio now streams instead of playing from a
      downloaded copy, which is what this checks.
- [x] 2026-11-16: the bitrate, by ear, from 192, 128 and 96 kbps samples of the same
      10-minute ocean meditation (`test-output/bitrate/` in the task's worktree): **128**.
      The three were hard to tell apart; 128 cuts every new file and every full listen by a
      third and keeps the narration at its ElevenLabs source rate. Live in the snapshot
      above; renders from before stay at 192. Supabase Pro is the answer if egress or
      storage still binds.
- [x] 2026-11-16: the backfill, which gives older renders their peaks: run now rather than
      after the 30 Nov reset, since this cycle's unused egress resets anyway. All 19 files
      (17 current, 2 earlier versions), 391,645,073 bytes downloaded once, none failed;
      every existing page streams. Then measured on Ho'oponopono: a view without play is
      90,256 bytes (was 23,469,496). Nothing should need it again, since renders write their
      own peaks; if a render ever lacks them, from the primary checkout, count first, then
      add `--yes`:
      `(set -a; . ./.env.local; NEXT_PUBLIC_SUPABASE_URL="$SOUND_EFFECTS_SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY" npx tsx scripts/backfill-peaks.ts)`.
- [x] 2026-11-16: production renders on the new snapshot (`snap_sXOy59qkIhIo95G7Y9N33oAaAPMY`).
      "Cold Plunge Breath Prep" rendered at 20:21 UTC: 11 min, 128 kbps, 8,000 peaks, and it
      sounds right. Then an edit to it, re-rendered at 20:28: the new version became current
      with its own peaks, the 20:21 one went to Earlier versions with its own, and both
      draw at once. (An earlier render that day, "Opening the Door to Abundance", came from
      the snapshot in between: peaks, but 192 kbps.) The two older snapshots,
      `snap_dJAgDRqRJ9ugYNwe0QWMl7uAUIy4` and `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`, were then
      deleted (`audio-pipeline` skill, step 9).

### When a report arrives (53)

A Report link mails `privacy@` with the meditation's title and URL. If it breaks the terms,
unlist it in the Supabase SQL editor (production), using the id at the end of the URL:

```sql
update public.meditations set is_public = false, is_featured = false where id = '…';
```

It leaves `/discover` and its page at once; the sitemap drops it within the hour. The owner
can make it public again from the "…" menu, so email them, and delete the meditation or the
account (`/terms`, "Be decent") if it comes back.

- [ ] After the avatar upload PR merges (its migration deploys with it): Supabase → Storage
      shows an `avatars` bucket, public, 1 MB limit, `image/webp` and `image/jpeg` allowed,
      with four policies on `storage.objects` named `avatars: owner …` (read, upload, update,
      delete). After the iPhone check in section 4, the bucket holds one file in your user's
      folder (the replaced and removed ones are gone).

## 6. Backups

- [x] 2026-11-16: Confirm the keepalive cron in Vercel's cron log, and take one production dump with the
      backup runbook (10). 2026-10-30: the route answers 401 without its secret, as it
      should; the cron log needs the dashboard. 2026-11-08: `vercel crons ls` shows the job
      registered (`/api/cron/keepalive`, `0 7 * * *`); the Hobby plan keeps runtime logs for
      30 minutes, so the run history is only in Project → Settings → Cron Jobs.
      2026-11-16: the first production dump is taken and verified (`zenerate-2026-11-16.sql`,
      477 KB): restored with 0 unexpected errors, 17 meditations all with scripts, 16 of
      them public as production shows signed out, 1 account. From now on it is weekly
      with `./scripts/backup.sh`, which dumps and verifies in one command (runbook "Taking
      a backup"). The cron too, 2026-11-16: Vercel moved cron jobs out of Settings (the old
      URL redirects to an empty Schedules page). The run history is in Observability →
      `/api/cron/keepalive`: the scheduled run fired at 07:15–07:20 UTC (Hobby fires within
      the hour), returned 2XX and called Supabase. Crons have been on since 2026-09-30
      (`vercel api /v9/projects/zenerate`), and a manual `vercel crons run
      /api/cron/keepalive` showed up there too.
- [x] 2026-11-16: Install the 30-day prune once, on every machine that holds dumps, passing the
      off-site folder if it is a synced folder on this Mac:
      `./scripts/schedule-backup-prune.sh "$HOME/Library/CloudStorage/<drive>/zenerate"`.
      Then check `launchctl print gui/$(id -u)/com.zeneratestudio.backup-prune` shows exit
      code 0 and `~/backups/zenerate/prune.log` is empty (52). Any dump already older than
      29 days is deleted on the first run. 2026-10-30: not installed on this Mac yet, and
      `~/backups/zenerate/` does not exist. 2026-11-16: installed with the iCloud folder
      (`~/Library/Mobile Documents/com~apple~CloudDocs/zenerate-backups`); the local folder
      prunes and is excluded from Time Machine, but the first run exited 1 with
      `Operation not permitted` on the iCloud folder. macOS blocks the background job there
      until `/usr/bin/find` has Full Disk Access (System Settings → Privacy & Security).
      Reinstalled the same day for the local folder only: exit code 0, `prune.log` empty.
- [x] 2026-11-16: Decide the off-site copy: none. Dumps stay on this Mac's disk until the
      move to Supabase Pro (section 8) makes the manual backups unnecessary. The iCloud copy
      made that morning was removed and sits in iCloud's Recently Deleted until about
      2026-12-16. Copies anywhere else need the job too (52).
- [x] 2026-11-16: From now on, each time you delete an account, `touch
      ~/backups/zenerate/deletions/<user-id>`. A restore re-deletes those accounts; one
      without a record comes back (52, runbook "Deletion records"). Agreed; the whole
      procedure for a deletion request is `docs/runbooks/account-deletion.md`.

## 7. Optional

- [x] 2026-11-16: skipped. The ElevenLabs Sound Effects permission only serves generating
      ambience candidates (44); the app never calls it.
- [x] 2026-10-30: every `.env.local` on this Mac (the primary checkout and the one remaining
      worktree) names the live snapshot `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`.

## 8. Open signups (task 38)

- [x] 2026-11-16: everything above is ticked, and ship tasks 48–60 are merged. The one open
      item above doesn't block: Sentry's first real report arrives with the first real
      error. Task 37 closed thin by choice: Sleep and Morning have one public meditation
      each (`tasks/ship/37-house-meditations.md`).
- [x] 2026-10-30: ship task 58 (launch security fixes) merged (PR #107) and its signed-out
      production checks pass; the signed-in checks and one live render are in section 5.
- [x] 2026-10-31: free tier decided for launch (`tasks/post-ship/paid-tier.md`): free with
      the current caps and no billing yet; open to 20–30 accounts, measure for a month,
      then price. The daily chat ceiling's code default is now 30 turns (was 200).
- [x] 2026-11-08: `PER_USER_DAILY_CHAT_MESSAGES` is not set in Vercel, Production or Preview,
      so the code default of 30 applies (ship 29 said to set it only to override the default).
- [ ] Supabase → Reports: write down the storage and egress figures on the day signups open.
      Until 2026-11-16 every meditation page view downloaded the whole audio file (22 MB
      for 15 minutes), so the free plan's 5 GB was about 230 views a month. Since task 60 a
      view without play is about 90 KB and the audio streams on play, so egress follows
      listening, a file per full listen (`tasks/ship/60-audio-egress.md`). The backfill that
      day spent 0.39 GB of this cycle's remainder. 2026-11-16 baseline, before launch, from
      Organization → Usage (cycle 30 Oct–30 Nov, all of it the operator's own seeding and
      testing, 1 monthly active user): egress 2.887 / 5 GB (58%), storage 0.351 / 1 GB
      (35%), database 0.029 / 0.5 GB. That leaves about 95 views of a 15-minute meditation
      this cycle and about 29 more 15-minute files in storage, which does not reset, so
      **go-live waits for the 30 Nov reset**. Record the figures again on that day.
- [x] 2026-11-06: Supabase → Authentication → Rate Limits: raise **emails per hour** from 25 to about
      100. Every email sign-in now sends a code (57), so 25 an hour runs out on a busy day.
      Check Resend's plan limits too: the free plan allows 100 a day and 3,000 a month.
- [ ] Supabase → Auth → enable signups.

## 9. After signups open

- [ ] Once sign-ups arrive, move to Supabase Pro ($25/mo): daily automated backups, and no
      7-day pause. 2026-11-16: waiting to see whether sign-ups come; until then the weekly
      `./scripts/backup.sh` and the keepalive cron carry on. Then follow the runbook's "Why
      this is manual": check the backup retention is 30 days or less (or change
      `/privacy`), move the deletion records, delete the old dumps, and retire the
      keepalive cron, the prune job and the manual backups. If storage reaches about 0.8 GB
      before sign-ups justify Pro, `tasks/post-ship/audio-storage-r2.md` is the free
      alternative: audio moves to Cloudflare R2.
- [ ] Ratings prompt (card ZEN-6, post-ship): send the Insight Timer end-of-session
      rating screenshots if you want the prompt restyled after them. Until then it follows
      DESIGN.md; a restyle touches only `src/components/rating-prompt.tsx` and
      `src/components/star-rating.tsx`. Detail in `tasks/post-ship/meditation-ratings.md`.

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
