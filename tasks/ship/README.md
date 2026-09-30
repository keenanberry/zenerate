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
| 06 | [ElevenLabs production account](./06-elevenlabs-production.md) | Not started | Free tier grants **no commercial rights**. Starter, $6/mo |
| 07 | [Production Supabase project](./07-production-supabase.md) | Not started | Staying on Free — see 10 |
| 08 | [Transactional email](./08-transactional-email.md) | Not started | Supabase's built-in sender is not production-viable |
| 09 | [Vercel deploy + domain](./09-vercel-deploy.md) | Not started | Repo goes public here. `zeneratestudio.com` |
| 10 | [Supabase keepalive + backups](./10-supabase-keepalive.md) | Not started | Free projects pause after 7 days and need a *manual* restore |

## Phase 2 — Product completeness

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | [Password reset flow](./11-password-reset.md) | Not started | Needs 08 |
| 12 | [Toast notifications](./12-toast-notifications.md) | Done | Success/error toasts on the mutation surface; add-to-collection gained real rollback. Theme verified in both modes |
| 13 | [Download button](./13-download-button.md) | Not started | Shape depends on 02 |
| 14 | [Error / not-found boundaries](./14-error-boundaries.md) | Done | Root 404 + root/`(app)` error boundaries + `global-error`. Lights up two existing `notFound()` call sites |
| 15 | [Terms / Privacy pages](./15-legal-pages.md) | Not started | Required for UGC |
| 16 | [LLM duration constraints](./16-llm-duration-constraints.md) | Not started | Sequence after 18 |
| 17 | [Sound effects library](./17-sound-effects-library.md) | Not started | Requires snapshot rebuild |
| 18 | [Script model upgrade](./18-script-model-upgrade.md) | Done* | Swapped to `claude-sonnet-5` with explicit low-effort thinking; parser now has tests. *Side-by-side comparison still needs an Anthropic key |
| 18c | [ESLint import restriction bypassed by relative paths](https://github.com/keenanberry/zenerate/issues/4) | Done | Rule now matches the module by basename regex, covering aliased, relative and dynamic-`import()` forms |
| 18b | [Public content unreachable signed out](./18b-public-content-signed-out.md) | Not started | Found during Phase 0. `(app)/layout.tsx` redirects every anon visitor, so /discover and public meditations are login-walled |

> **If you need to launch sooner, this is the phase to cut.** 14 and 15 are genuinely
> required. 16 and 17 could slip to `post-ship/` without embarrassment.

## Phase 3 — Brand & PWA

| # | Task | Status | Notes |
|---|---|---|---|
| 19 | [Repo skills](./19-repo-skills.md) | Not started | **Do first** — keeps 20–23 consistent across sessions |
| 20 | [Typography foundation](./20-typography-foundation.md) | Not started | Lora is declared 3× in `globals.css` and never loaded |
| 21 | [Nocturne pass](./21-nocturne-pass.md) | Not started | Dark-first + gradient player. Largest task in the phase |
| 22 | [Landing page rewrite](./22-landing-page-rewrite.md) | Not started | Still advertises audio as "(Coming soon)" |
| 23 | [Icon set + OG image](./23-icon-set-og-image.md) | Not started | `public/` is still the Next.js starter SVGs |
| 24 | [PWA manifest & install](./24-pwa-manifest.md) | Not started | Installable, no service worker |
| 25 | [Lock-screen audio](./25-lock-screen-audio.md) | Not started | Highest-value item in the phase |
| 26 | [SEO metadata](./26-seo-metadata.md) | Not started | Needs 22 (pitch) and 23 (OG image) |

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
