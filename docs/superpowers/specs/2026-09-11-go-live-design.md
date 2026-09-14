# Go-Live Design

**Date:** 2026-09-11
**Status:** Approved decisions, pending implementation plan
**Scope:** Everything required to put Zenerate in front of real users, plus an installable PWA and a brand pass.

---

## Summary

Zenerate is feature-complete enough to ship. What's missing is not features — it's the
work that turns a local project into a deployed product: an unmetered API endpoint that
would be free to abuse the moment the repo goes public, an ElevenLabs account that
doesn't grant commercial rights, no production email, no deploy, and a UI that reads as
stock shadcn rather than a meditation app.

This document records the decisions made during brainstorming on 2026-09-11 and the
reasoning behind each, so the implementation plan can be written against a fixed target.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Product name | **Zenerate** (unchanged) | The zen+generate portmanteau works and already has equity in the codebase. |
| Domain | **`zeneratestudio.com`** | `.com` at normal pricing. `zenerate.com/.app/.ai` are taken; `.audio` is $250/yr, `.fm` similar, `.studio` $80/yr. A hyphenated `.com` was rejected — the hyphen is a permanent tax on saying the URL aloud. `zener8` was rejected: a numeral puts a wellness brand in SaaS/gamertag register, "Zener" reads as an electrical component, and it only decodes if you already know the joke. |
| Domain wiring | `NEXT_PUBLIC_SITE_URL` | Nothing hardcodes a domain, so `zenerate.studio` remains an easy upgrade later. |
| TTS provider tier | **ElevenLabs Starter, $6/mo** | The free tier grants **no commercial use rights** and requires attribution — a licensing blocker for a public app, independent of voice quality. Starter also unlocks the Voice Library, which is where usable meditation voices live. Measured ~930 speech characters per meditation, so 30k credits ≈ 30 meditations/month. Upgrade to Creator ($22, ~120/mo) when that binds. |
| Script model | **`claude-sonnet-5`** | Currently `claude-sonnet-4-6`. Sonnet 5 is newer *and* cheaper ($2/$10 vs $3/$15 per MTok). Strict improvement. |
| Visual direction | **Nocturne, dark-first, with a gradient player** | Dark matches when people actually meditate, and the amethyst-haze palette has real character in dark (the light theme is near-neutral grey at chroma 0.004). One gradient moment on the player gives a signature without committing the whole interface to a trend that ages. |
| Light mode | **First-class, `defaultTheme="system"`** | Dark-first means dark drives design decisions and marketing surfaces; light must still be correct everywhere. Light needs added chroma and a tinted (not glowing) gradient treatment. |
| PWA depth | **Installable + lock-screen audio now; offline and push later** | Install is ~an hour with `app/manifest.ts` and no service worker. Offline playback and web push are genuine features that need a service worker and belong post-ship. |
| Hosting | **Vercel Hobby** | Sandbox on Hobby allows 5 Active-CPU-hours/mo, 420 GB-hours memory, 10 concurrent, 45-min sessions — roughly 300 generations/month, ~10× above the ElevenLabs ceiling. Not a constraint. Note Hobby prohibits commercial use, so a future paid tier requires Vercel Pro. |
| Database | **Supabase Free + daily keepalive cron + weekly `pg_dump`** | Free projects pause after 7 days of low activity and require a *manual* dashboard restore — which would break the phone use case outright. A daily cron ping keeps the project active for $0. Residual risk is the weak backup story, mitigated by the dump. Upgrade to Pro ($25/mo) when there's data worth missing. |

**Estimated run cost:** ~$8/month (domain ~$1, ElevenLabs $6, Anthropic <$1, Vercel $0, Supabase $0).

---

## Findings that drive the work

These were discovered by reading the code, not assumed. Each becomes a task.

### 1. `/api/generate` is unauthenticated and unmetered — ship blocker

`src/app/api/generate/route.ts` reads `prompt` off the request body and streams from
Anthropic with no `getUser()` check and no quota. The generation-quota work protected
ElevenLabs only. `tasks/ship/02` makes the repo public, publishing the endpoint's exact
shape alongside it. Anyone could use it as a free Claude proxy on the project's key.

Fix: auth check plus a per-user script-generation quota, reusing the existing
`src/lib/audio/quota.ts` reservation pattern.

### 2. Audio URLs are 1-year signed URLs persisted to the database

`src/lib/audio/storage.ts:39` mints a 365-day signed URL and writes it to
`meditations.audio_url`. Two consequences: every meditation's audio silently 404s a year
after generation, and the URL is a bearer token — a *private* meditation's audio is
readable by anyone holding the link, regardless of RLS.

Fix: keep the bucket private, stop persisting the URL, mint a short-lived signed URL
server-side at page load.

### 3. Upgrading ElevenLabs changes nothing until a filter changes

`src/app/api/voices/route.ts:39` filters `v.category === "premade"` against a hardcoded
set of six names. Voice Library voices added to the account return a different category,
so they will not appear in the picker. The plan upgrade is invisible without this change.

### 4. `voiceSettings` is built but never sent

`src/lib/audio/generate-audio.ts:37-41` accepts `stability`, `similarityBoost`, `style`,
and `speed`. The config object assembled in `src/lib/audio/workflow.ts:74-80` omits it,
so every voice runs on the hardcoded fallback (`stability 0.5`, `speed 0.85`). The
plumbing exists and is disconnected. Different meditation voices want different tuning.

Note: `generate-audio.ts` is baked into the sandbox snapshot — this change requires
`npx tsx scripts/create-sandbox-snapshot.ts` and a new `AUDIO_SANDBOX_SNAPSHOT_ID`.

### 5. The circuit breaker is calibrated for a plan we aren't buying

`MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=500` × ~930 chars ≈ 465k credits/month, which is
ElevenLabs Pro ($99). On Starter the breaker sits ~17× above the real ceiling and would
never fire before ElevenLabs cut us off.

Starter's 30k credits ÷ ~930 chars ≈ 32 generations. Set the global cap to **25**, leaving
headroom for retries and longer-than-average scripts, and treat the value as derived from
the plan rather than a standalone constant — a comment in `.env.example` should say so.

### 6. Lora is declared three times and never loaded

`src/app/globals.css` sets `--font-serif: "Lora", Georgia, serif` at lines 48, 110, and
166. `src/app/layout.tsx` loads only Geist and Geist Mono. Nothing in the app uses
`font-serif`. The calm, literary half of the amethyst-haze theme was specified and
silently dropped — this is the single highest-leverage design fix.

### 7. Supabase default SMTP is not production-viable

`tasks/ship/01` currently says "SMTP configured (or Supabase default)". The built-in
sender is rate-limited to a handful of emails per hour and is not intended for
production. Both signup confirmation and password reset depend on it.

### 8. Smaller items

- No CI. `vitest` and `eslint` are configured; no workflow runs them. The repo is about to become public.
- `src/app/page.tsx:15` advertises audio as "(Coming soon)". Audio ships.
- `public/` still contains the Next.js starter SVGs. No icons, no OG image, no apple-touch-icon.
- `tasks/ship/11` claims the root layout has no `metadata` export; `src/app/layout.tsx:19` has one.
- `.env.example` omits `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` and `NEXT_PUBLIC_SITE_URL`.

---

## Restructured ship checklist

The existing 12 tasks are re-ordered into four phases and joined by 14 new ones, for 26
total. Numbers follow phase order; earlier phases gate later ones.

### Phase 0 — Security & correctness

Nothing else matters if these are wrong, and two of them get worse the moment the repo
goes public.

| # | Task | Origin |
|---|---|---|
| 01 | Secure the script generation endpoint | new — finding 1 |
| 02 | Audio URL lifetime & privacy | new — finding 2 |
| 03 | Recalibrate generation quota to the ElevenLabs plan | amends old 03 — finding 5 |
| 04 | Seed data prod guard | old 12 |
| 05 | CI pipeline (lint, typecheck, test) | new — finding 8 |

### Phase 1 — Accounts & deploy

| # | Task | Origin |
|---|---|---|
| 06 | ElevenLabs production account, voice curation, filter + settings wiring | new — findings 3, 4 |
| 07 | Production Supabase project | old 01 |
| 08 | Transactional email (Resend or similar) | new — finding 7, split from old 01 |
| 09 | Vercel deploy + `zeneratestudio.com` | old 02 |
| 10 | Supabase keepalive cron + weekly backup | new |

### Phase 2 — Product completeness

| # | Task | Origin |
|---|---|---|
| 11 | Password reset flow | old 08 |
| 12 | Toast notifications (Sonner) | old 07 |
| 13 | Download button | old 06 |
| 14 | Error / not-found boundaries | old 10 |
| 15 | Terms / Privacy pages | old 09 |
| 16 | LLM duration constraints | old 04 |
| 17 | Sound effects library | old 05 |
| 18 | Script model upgrade to `claude-sonnet-5` | new |

### Phase 3 — Brand & PWA

| # | Task | Origin |
|---|---|---|
| 19 | Repo skills — design system, audio pipeline | new |
| 20 | Typography foundation — load Lora, apply to script and headings | new — finding 6 |
| 21 | Nocturne pass — dark-first surfaces, gradient player, spacing | new |
| 22 | Landing page rewrite — dark hero, fix stale "coming soon" copy | new — finding 8 |
| 23 | Icon set + OG image | new — finding 8 |
| 24 | PWA manifest & install | new |
| 25 | Lock-screen audio (Media Session API) | new |
| 26 | SEO metadata | old 11, amended |

Task 19 comes first in the phase deliberately: the design skill is what keeps tasks
20–23 consistent when they're implemented across separate sessions.

---

## Design notes for Phase 3

### Repo skills (19)

The Nocturne direction only survives if it's written down somewhere an agent reads before
touching UI. Two skills earn their place; anything else is premature.

**`.claude/skills/zenerate-design/`** — the design system as an enforceable contract.
Palette tokens and which ones are actually load-bearing, the Lora/Geist split and where
each applies, the spacing scale, the gradient motif and its light-mode variant, the
dark-first review rule (build dark, verify light, never the reverse), and the anti-patterns
this codebase has already drifted into — declaring a token without loading the font,
reaching for a raw Tailwind colour instead of a theme token, shadow-based elevation on
dark surfaces. Triggers on any UI or styling work.

**`.claude/skills/audio-pipeline/`** — the snapshot procedure. `CLAUDE.md` states the
gotcha ("`generate-audio.ts` is baked into the snapshot") but not the workflow: rebuild,
capture the printed ID, update `AUDIO_SANDBOX_SNAPSHOT_ID` in both `.env.local` and
Vercel, verify with `scripts/test-audio-generation.ts`. The failure mode is silent — the
edit lands, nothing changes at runtime, and it looks like the code is wrong. That's
exactly the shape of thing a skill should catch.

Deliberately **not** creating skills for migrations or Supabase client selection — the
existing `CLAUDE.md` conventions table already covers those, and a skill that restates
`CLAUDE.md` adds maintenance burden without adding signal.

### Typography (20)

Load Lora via `next/font/google` alongside Geist, expose it as `--font-serif`, and apply
it to meditation script text and page headings. Script text at ~1.9 line-height and a
~65ch measure. This alone moves the app from "dashboard" to "reading surface".

### Nocturne (21)

Dark is the design target. Surfaces sit close to the background rather than floating on
shadows; the player carries a soft radial glow in the primary purple; spoken lines
brighten as they play and dim once passed. Vertical rhythm loosens throughout — the
current `py-8` / `h-14` density is dev-tool density.

The one gradient moment is the player: purple→rose across the play button and the
played portion of the waveform, finally using the `--accent` rose the theme defines and
nothing touches. In light mode the same gradient renders as a flat tint, not a glow.

### PWA (24) and lock-screen audio (25)

Install needs `app/manifest.ts` with `display: "standalone"`, `theme_color`,
`background_color`, `start_url`, Next's `appleWebApp` metadata for the iOS meta tags, and
icons at 192/512/maskable-512 plus a 180×180 apple-touch-icon. No service worker.

Lock-screen audio matters more than installability for this product and is easy to miss:
a meditation user closes their eyes and the screen locks. Confirm wavesurfer is backed by
a real `<audio>` element, then populate `navigator.mediaSession.metadata` with the
meditation title and artwork so playback survives lock and the controls appear on the
lock screen.

---

## Explicitly out of scope

Deferred to `tasks/post-ship/` and `docs/ui-roadmap.md`:

- Offline playback and web push (need a service worker; push additionally requires the PWA be installed).
- Discover filters, sorting, infinite scroll.
- Skeleton loaders and illustrated empty states.
- Conversational script regeneration; the form-based script editor.
- User profiles, paid tier, OAuth providers, admin dashboard, moderation, analytics, error tracking.
- Native mobile. The PWA is explicitly the answer for now.

---

## Open items to verify during implementation

- **Vercel Workflow plan gating.** The `workflow` package is at `^4.1.0-beta.60`; its availability on Hobby was not confirmed. Verify on first deploy — if it requires Pro, that changes the cost table.
- **Whether a daily cron reliably prevents Supabase pausing.** Supabase describes the heuristic as "low activity over a 7-day period" without publishing a threshold. A daily authenticated query should qualify, but this is a workaround, not a supported feature. Watch for a pause notification in the first month.
