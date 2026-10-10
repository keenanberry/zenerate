# Ship Checklist

Work required before deploying Zenerate to real users.

Decisions and rationale live in **`docs/superpowers/specs/2026-09-11-go-live-design.md`** —
read that first. This folder is the operational tracking.

Tasks are grouped into four phases. Earlier phases gate later ones; within a phase, take
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
| 08 | [Transactional email](./08-transactional-email.md) | Done* | Resend via its Supabase integration, `noreply@zeneratestudio.com`, templates in `supabase/templates/`. *Operator: paste the two templates into the production dashboard, then the inbox-placement check |
| 09 | [Vercel deploy + domain](./09-vercel-deploy.md) | Deployed | Live at `www.zeneratestudio.com`, repo public, auth working, generation end to end in production 2026-10-10. `NEXT_PUBLIC_SITE_URL` still to set to the `www` host |
| 10 | [Supabase keepalive + backups](./10-supabase-keepalive.md) | In progress | Cron route + `vercel.json` + tested restore script done. Needs `CRON_SECRET`, a prod dump, and cron confirmed firing |

## Phase 2 — Product completeness

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | [Password reset flow](./11-password-reset.md) | Not started | Needs 08 |
| 12 | [Toast notifications](./12-toast-notifications.md) | Done | Success/error toasts on the mutation surface; add-to-collection gained real rollback. Theme verified in both modes |
| 13 | [Download button](./13-download-button.md) | Done* | Streams via an authorized route, never `<a download>` on a signed URL. *iOS Safari check needs a real device |
| 14 | [Error / not-found boundaries](./14-error-boundaries.md) | Done | Root 404 + root/`(app)` error boundaries + `global-error`. Lights up two existing `notFound()` call sites |
| 15 | [Terms / Privacy pages](./15-legal-pages.md) | Done* | `/terms` + `/privacy` live, linked from signup and a site-wide footer. *Launch gate: the `privacy@` forwarder (with 08) |
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
| 25 | [Lock-screen audio](./25-lock-screen-audio.md) | Done* | Media Session on wavesurfer's own `<audio>`: title, artwork, play/pause, 15 s skips, seekbar. iPhone lock screen and PWA confirmed by the operator 2026-10-10. *Mac Now Playing is still unchecked |
| 26 | [SEO metadata](./26-seo-metadata.md) | Done* | `metadataBase` from `NEXT_PUBLIC_SITE_URL` (falls back to production), the pitch as default description, OG image + large Twitter card, per-page cards for `/`, `/discover` and public meditations, `robots.ts`, live `sitemap.ts`. `/meditation/[id]` still dynamic. *Real-app share previews and the Facebook debugger are the operator's, after deploy |

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
