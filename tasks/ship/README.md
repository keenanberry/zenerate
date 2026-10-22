# Ship Checklist

Work required before deploying Zenerate to real users.

Decisions and rationale live in two specs: **`docs/superpowers/specs/2026-09-11-go-live-design.md`**
for Phases 0–3, and **`docs/superpowers/specs/2026-10-20-agentic-studio-design.md`** for
Phases 4–6 (the chat studio, Discover, seeding and launch). Read the one for your phase
first. This folder is the operational tracking.

**Operator to-dos live in [`tasks/OPERATOR-TODO.md`](../OPERATOR-TODO.md)**: one checklist for everything only the operator can do.

**Signups stay closed until Phase 6 is done.** There is no launch date: Zenerate opens
when the list below is finished, not before.

Tasks are grouped into seven phases. Earlier phases gate later ones; within a phase, take
the lowest-numbered `Not started` task unless its `Depends on` says otherwise.

---

## Phase 0 — Security & correctness

Nothing else matters if these are wrong, and two of them get materially worse the moment
the repo goes public in task 09.

| # | Task | Status | Notes |
|---|---|---|---|
| 01 | [Secure the script generation endpoint](./01-secure-script-endpoint.md) | Done | **Highest severity.** `/api/generate` now requires auth and enforces its own quota |
| 02 | [Audio URL lifetime & privacy](./02-audio-url-lifetime.md) | Done | Signed URLs are short-lived and minted at read time via an authorized hydrator, not stored |
| 03 | [Recalibrate generation quota](./03-recalibrate-quota.md) | Done | Quota system is done; cap recalibrated to match the ElevenLabs Starter plan |
| 04 | [Seed data prod guard](./04-seed-data-prod-guard.md) | Done | Seed data is local-only by convention and documented; test users kept out of prod |
| 05 | [CI pipeline](./05-ci-pipeline.md) | Done | `.github/workflows/ci.yml` runs lint, typecheck, test, build on push/PR |

## Phase 1 — Accounts & deploy

| # | Task | Status | Notes |
|---|---|---|---|
| 06 | [ElevenLabs production account](./06-elevenlabs-production.md) | Done | Starter active (operator, 2026-10-09); voices via the Zenerate collection (PR #25). Per-voice tuning deferred |
| 07 | [Production Supabase project](./07-production-supabase.md) | Done | Live. Migrations, private bucket, email confirmation and redirects all verified; script and audio generation both ran in production 2026-10-10 |
| 08 | [Transactional email](./08-transactional-email.md) | Done | Resend via its Supabase integration, `noreply@zeneratestudio.com`, templates in `supabase/templates/`, pasted into production by the operator 2026-10-20. The reset email's end-to-end check moves to 11 |
| 09 | [Vercel deploy + domain](./09-vercel-deploy.md) | Done | Live at `www.zeneratestudio.com`, repo public, auth working, generation end to end in production 2026-10-10. `NEXT_PUBLIC_SITE_URL` set to the `www` host (operator, 2026-10-20) |
| 10 | [Supabase keepalive + backups](./10-supabase-keepalive.md) | In progress | Cron route + `vercel.json` + tested restore script done; the operator reports the cron working (2026-10-20). Still to confirm: the cron's run log in Vercel, and a production dump from the backup job |

## Phase 2 — Product completeness

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | [Password reset flow](./11-password-reset.md) | Done* | `/forgot-password`, `/reset-password` and the login link; local E2E through the test inbox; callback `next` now same-origin only (PR #51). *Operator: add `https://www.zeneratestudio.com/auth/callback**` to Supabase Redirect URLs, then the production E2E |
| 12 | [Toast notifications](./12-toast-notifications.md) | Done | Success/error toasts on the mutation surface; add-to-collection gained real rollback. Theme verified in both modes |
| 13 | [Download button](./13-download-button.md) | Done* | Streams via an authorized route, never `<a download>` on a signed URL. *iOS Safari check needs a real device |
| 14 | [Error / not-found boundaries](./14-error-boundaries.md) | Done | Root 404 + root/`(app)` error boundaries + `global-error`. Lights up two existing `notFound()` call sites |
| 15 | [Terms / Privacy pages](./15-legal-pages.md) | Done* | `/terms` + `/privacy` live, linked from signup and a site-wide footer. *Launch gate: the `privacy@` forwarder, still to set up (operator) |
| 16 | [LLM duration constraints](./16-llm-duration-constraints.md) | Done | Long sessions were 82% of requested; now 98%, with the spread cut from 24 points to 6. Measured before/after |
| 17 | [Sound effects library](./17-sound-effects-library.md) | Done* | 4 synthesized + 2 CC0 gongs, plus narration normalized to -20 LUFS. *Needs the new snapshot ID in Vercel + redeploy |
| 18 | [Script model upgrade](./18-script-model-upgrade.md) | Done* | Swapped to `claude-sonnet-5` with explicit low-effort thinking; parser now has tests. *Side-by-side comparison still needs an Anthropic key |
| 18c | [ESLint import restriction bypassed by relative paths](https://github.com/keenanberry/zenerate/issues/4) | Done | Rule now matches the module by basename regex, covering aliased, relative and dynamic-`import()` forms |
| 18b | [Public content unreachable signed out](./18b-public-content-signed-out.md) | Done | `/discover` and public meditations open signed out; downloads stay account-only. `anon` grant verified in production 2026-10-10 with no cookies |

> **If you need to launch sooner, this is the phase to cut.** 14 and 15 are genuinely
> required. 16 and 17 could slip to `post-ship/` without embarrassment.

## Phase 3 — Brand & PWA

| # | Task | Status | Notes |
|---|---|---|---|
| 19 | [Repo skills](./19-repo-skills.md) | Done | `zenerate-design` + `audio-pipeline` skills, tested with and without; `DESIGN.md` and `PRODUCT.md` written for Impeccable. Read `DESIGN.md` before 20–23 |
| 20 | [Typography foundation](./20-typography-foundation.md) | Done | Lora + Geist + Geist Mono wired through their `next/font` variables; script in Lora at 1.9 / 65ch, page headings in Lora, chrome in Geist |
| 21 | [Nocturne pass](./21-nocturne-pass.md) | Done | Dark-first surfaces, no in-flow shadows, gradient player with halo, script follows playback, markers in small-caps sans, rhythm table in `DESIGN.md`. Phone and installed-PWA checks confirmed by the operator 2026-10-10 |
| 22 | [Landing page rewrite](./22-landing-page-rewrite.md) | Done* | Locked pitch as hero, a script streaming into the real viewer, newest public meditation, free tier read from the quota config. Shared `Nav` on landing and legal. Lighthouse 93/100 mobile, 100/100 desktop. Installed-PWA check confirmed by the operator 2026-10-10 |
| 23 | [Icon set + OG image](./23-icon-set-og-image.md) | Done* | Bodhi leaf mark with its veins drawn as a tree (`src/assets/brand/mark.svg`), a `BrandMark` component, every raster rebuilt by `scripts/build-icons.ts`. Mark placed in the nav and login card (follow-up); now the lotus (PR #40). *Share previews are still the operator's; the phone home-screen check was confirmed 2026-10-10 |
| 24 | [PWA manifest & install](./24-pwa-manifest.md) | Done | Manifest at `/manifest.webmanifest` (standalone, opens to `/dashboard`, Midnight theme, maskable icon), iOS meta with the `default` status bar, no service worker. Lighthouse installability passes. iPhone install and in-app playback confirmed by the operator 2026-10-10 |
| 25 | [Lock-screen audio](./25-lock-screen-audio.md) | Done | Media Session on wavesurfer's own `<audio>`: title, artwork, play/pause, 15 s skips, seekbar. iPhone lock screen and PWA confirmed by the operator 2026-10-10; Mac Now Playing confirmed 2026-10-20 |
| 26 | [SEO metadata](./26-seo-metadata.md) | Done* | `metadataBase` from `NEXT_PUBLIC_SITE_URL` (falls back to production), the pitch as default description, OG image + large Twitter card, per-page cards for `/`, `/discover` and public meditations, `robots.ts`, live `sitemap.ts`. `/meditation/[id]` still dynamic. *Real-app share previews and the Facebook debugger are the operator's, after deploy |

## Phase 4 — Studio (Wave A: everything seeding needs)

The create wizard and the script editor are replaced by one conversation: describe the
meditation, watch the script stream into a canvas beside the chat, change it by asking,
and make the audio from cards in the chat. See the studio spec.

| # | Task | Status | Notes |
|---|---|---|---|
| 27 | [AI SDK 7 upgrade](./27-ai-sdk-7.md) | Done | `ai` 7.0.148, `@ai-sdk/react` 4, `@ai-sdk/anthropic` 4; the Outcome lists the v7 API names (PR #50) |
| 28 | [Studio schema + operator wipe](./28-studio-schema.md) | Done | Migration `20261021000000_studio_schema.sql`; search vector by trigger; chats link only to the owner's meditation (PR #49). Applied by the Supabase GitHub integration on merge; [wipe runbook](../../docs/runbooks/operator-data-wipe.md) run by the operator 2026-10-21 |
| 29 | [Chat agent route](./29-chat-agent.md) | Done* | `/api/chat` with `writeScript`/`setDetails`/`offerAudio`, 200-a-day ceiling, 8 Discover categories; four real-model prompt checks pass (PR #52). *Operator: remove the old script-quota env vars in Vercel |
| 30 | [Studio UI: chat + canvas](./30-studio-ui.md) | Done* | One input + Recent drafts, two panes, phone sheet with a Script updated pill, canvas follows the stream; wizard and editor deleted (PR #54). *Operator: a real-phone keyboard check; judge the script measure |
| 31 | [Audio from the chat](./31-audio-from-chat.md) | Done* | Audio card, draft renders, compare-and-set against double clicks, `QUOTA_EXEMPT_USER_IDS` (PR #53). *Operator: set the exemption in Vercel; one real render on a deploy |

## Phase 5 — Studio (Wave B) & Discover

| # | Task | Status | Notes |
|---|---|---|---|
| 32 | [Versions, replace-or-keep, continue in chat](./32-versions.md) | Done* | Audio at `<user_id>/<meditation_id>/<uuid>.mp3`, never overwritten, folder removed with the meditation; draft renders tracked in `draft_status` so public pages keep playing; archive on promotion, keep-or-replace in chat, owner-only switcher, Continue in chat; fixed draft text leaking into public HTML (PRs #60, #61). *Operator: one real render on a deploy |
| 33 | [Details editing + tag display](./33-details-and-tags-ui.md) | Done* | Inline title, description and tag editing for the owner; `TagPills` on the page, cards and rows (PR #57). *Operator: phone tap check on tag remove buttons |
| 34 | [Sound previews in chat](./34-sound-previews.md) | Done* | `previewSounds` tool + card; six sounds in `public/sounds/` via `scripts/export-sound-previews.ts`; snapshot unchanged (PR #58). *Operator: iPhone playback |
| 35 | [Designed cover system](./35-cover-system.md) | Done* | `MeditationCover`: flat tone fields, five motifs, colour from the first tag's group; `DESIGN.md` Covers rule, no gradient (PR #56). *Operator: real-phone look |
| 36 | [Discover rebuild](./36-discover-rebuild.md) | Done* | Search + filters, 8 category cards, Popular (favorites + signed-in plays, owner excluded) and Picked for you, both falling back to `is_featured`; `discover_meditations` / `popular_meditations` granted to `anon` (PR #59). *Operator: mark house picks `is_featured` (task 37), production signed-out `curl` |

## Phase 6 — Seed & open

| # | Task | Status | Notes |
|---|---|---|---|
| 37 | [House meditations](./37-house-meditations.md) | In progress | Operator makes 24 through the chat, 3 per category; 6–8 featured with `is_featured` (Popular and Picked for you stay hidden until then). Snapshot with ambience is live, so seeds get beds |
| 38 | [Privacy update + open signups](./38-privacy-and-launch.md) | In progress | Code half done (PR #63): `/privacy` covers conversations, plays, versions and what goes public; chat text no longer copied to `meditations.prompt`. Left: the operator's launch checklist, ending with enabling signups |
| 38b | [Drafts owner-only](./38b-drafts-owner-only.md) | Done | Drafts live in owner-only `meditation_drafts` (PR #64 migration, then #65 code + column drop). Verified in production as `anon`: `meditations.draft_script` → 42703, `meditation_drafts` → 42501 |
| 39 | [Studio mobile fixes](./39-studio-mobile-fixes.md) | Done* | Sideways scroll from the player halo, the composer pinned to the visual viewport on the studio route, the voice picker on a container query, the meditation header's actions on their own row (PR #66). *Operator: real-iPhone keyboard and PWA checks |
| 40 | [Ambient background sound](./40-ambient-sound.md) | Done | Five beds (rain, ocean, forest, drone, brown noise) on the Make audio card, None by default; fixed amix normalization dropping narration 6 dB (PR #68). Snapshot rebuilt and live (see 44) |
| 41 | [Cap script rewrites](./41-cap-rewrites.md) | Done | Accept within ±2 min or ±15%; one length-driven rewrite per turn, enforced in code; writes per turn 1.19 → 1.05 (PR #67) |
| 42 | [Cover variety](./42-cover-variety.md) | Done* | Hue pair per tag from 10 hues, 14 motifs (9 not round), mirrored and varied compositions; 21 → 47 distinct looks in 48; `setDetails` accepts a comma-separated tags string (PR #69). *Operator: phone check of Discover and Library |
| 43 | [Next step after every draft](./43-next-step-after-draft.md) | Done* | Every script turn ends with a length-and-choice line; Make the audio / Change something chips; Make the audio only offers the card (10/10 each) (PR #70). *Operator: phone check of the chips |
| 44 | [Space + Chant ambience](./44-space-ambience.md) | Done | Brown noise removed; synthesized Space and CC0 Chant (Temple monks, #545055) added; previews at the in-mix level (-37 LUFS); snapshot `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8` live in Production and Preview, verified by the operator 2026-10-22 (PR #72) |
| 45 | [Landing refresh](./45-landing-refresh.md) | Done* | Demo shows a typed request and the agent's closing line, no "focus" wording; steps mention ambience and revising; "Hear one first" is 3 covered meditations, house picks once 3 exist, else newest (PR #73). *Operator: production checks in the PR |
| 46 | [Landing hero height](./46-landing-hero-height.md) | Done* | Fixed-height demo window that follows the stream; headline at 121px instead of 426px (PR #75). *Operator: swipe over the demo card on a phone |
| 47 | [Model comparison](./47-model-comparison.md) | Done | Sonnet 5 vs 5.5 vs Haiku 5.5 on real studio turns; fixed a tools-changed history 400 on the newer models; `STUDIO_MODEL` setting (PR #77, closes #19). **Production on `claude-sonnet-5-5` since 2026-10-22**: about half the cost per meditation |

### Running Phases 4–5 with Orca

Wave A runs as three parallel lanes after 27 and 28: **29 → 30**, **29 → 31** (31 can
build its cards beside 30 against 30's `renderStudioPart`), then 37 opens once 27–31
are in production. Wave B (32–36) is five mostly independent workers. 35 and 36 touch
Discover and can pair, and 36 can start with a placeholder cover slot.

- **Workers edit only their own task file.** The coordinator updates this README's
  tables, because parallel edits to adjacent rows conflict every time.
- **Localhost workers share one Supabase auth cookie.** No worker signs out.
- **The `npmrc-legacy-peer-deps` note applies:** never commit a worker's whole-lockfile
  churn.

### Review focus for Phases 4–5

These are the failure modes the spec implies that no single task's tests cover. Each
reviewer checks the ones that touch their task:

1. **A reload or closed tab mid-stream.** A half-written script must never be saved or
   shown as the script; the canvas shows the last complete one (29, 30).
2. **Off-topic and injection requests.** "Write me code" or "ignore your instructions"
   gets a one-line decline (29).
3. **A revision silently drops content.** Malformed markers surface in the tool result,
   and the duration estimate flags a 20-minute script that shrank (29, 30).
4. **Audio without a click.** Nothing but the card's button and the page's retry calls
   the trigger route, and a double click reserves once (31).
5. **Chat privacy in production.** As `anon` and as another user, the chat tables return
   nothing for a public meditation. Local grants hide a mistake, so check production
   (28, 38).

---

## How to use this folder

Grab the lowest-numbered `Not started` task in the earliest incomplete phase. Read its
file, check its `Depends on`, set status to `In progress`, implement, then set `Done` and
update the table above. Each task file carries acceptance criteria — verify against them
before marking anything done.

## Renumbering note (2026-09-11)

This folder previously held 12 flat tasks. They were re-ordered into the phases above and
joined by 14 new ones found by auditing the code against the old list. Old → new mapping:

| Old | New |
|---|---|
| 01 production-supabase | 07 |
| 02 vercel-deploy | 09 |
| 03 generation-quota (Done) | 03 recalibrate-quota |
| 04 llm-duration-constraints | 16 |
| 05 sound-effects-library | 17 |
| 06 download-button | 13 |
| 07 toast-notifications | 12 |
| 08 password-reset | 11 |
| 09 legal-pages | 15 |
| 10 error-boundaries | 14 |
| 11 seo-metadata | 26 |
| 12 seed-data-prod-guard | 04 |

Post-ship work is in `tasks/post-ship/`; UX-focused ideas are in `docs/ui-roadmap.md`.
