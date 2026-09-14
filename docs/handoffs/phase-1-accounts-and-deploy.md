# Handoff — Phase 1: Accounts & Deploy

**Written:** 2026-09-14
**Branch:** `keenanberry/feat-go-live-prep` (PR #8 open against `main`, CI green)
**Read first:** `docs/superpowers/specs/2026-09-11-go-live-design.md` — the decisions and why

---

## What we set out to do

Get Zenerate deployed publicly. Work is tracked in `tasks/ship/`, 26 tasks across four
phases. Phase 0 (security & correctness) is complete and in PR #8.

## What's done

Phase 0, all five tasks, reviewed and green:

| Task | What changed |
|---|---|
| 01 | `/api/generate` had no auth and no quota — now auth-gated, input-validated, output-capped, and metered by a new `script_generation_events` ledger |
| 02 | Audio moved from persisted 365-day signed URLs to a stored path signed for 4 hours at read time |
| 03 | Audio global cap 500 → 25, derived from the ElevenLabs Starter plan |
| 04 | Production guard on `supabase/seed.sql` |
| 05 | GitHub Actions CI — install, lint, typecheck, test, build |

40 tests passing, lint clean, typecheck clean, CI green on GitHub.

## Decisions already made — do not relitigate

| | |
|---|---|
| Domain | **`zeneratestudio.com`** — `.com` at normal pricing. `zenerate.com/.app/.ai` taken; `.audio` $250/yr; `.studio` $80/yr. Wire it through `NEXT_PUBLIC_SITE_URL`, never hardcode |
| ElevenLabs | **Starter, $6/mo.** The free tier grants **no commercial use rights** — this is a licensing blocker, not a quality preference. Starter also unlocks the Voice Library |
| Supabase | **Free plan + daily keepalive cron + weekly `pg_dump`.** Free projects pause after 7 days of low activity and need a *manual* dashboard restore, which would break the phone use case |
| Vercel | **Hobby.** Sandbox on Hobby allows ~300 generations/month, ~10× the ElevenLabs ceiling. Note Hobby prohibits commercial use — a future paid tier needs Vercel Pro |
| Visual direction | Nocturne (dark-first) with a gradient player. Phase 3 |

Estimated run cost: ~$8/month.

---

## The sequencing question, answered

**Phase 1 is almost entirely human work. Phase 2 and 3 are almost entirely agent work.
Run them in parallel.**

An agent cannot buy an ElevenLabs subscription, create a Supabase project, register a
domain, or add DNS records. Those are the substance of Phase 1.

Meanwhile **9 of 10 Phase 2 tasks are unblocked right now**, and most of Phase 3 is too.
The dependency table in `tasks/ship/README.md` implies Phase 2 waits on Phase 1; in
practice it mostly doesn't:

| Phase 2 task | Actually blocked? |
|---|---|
| 11 password reset | **No.** Supabase ships a local mail catcher (`[inbucket]` in `config.toml`, `http://127.0.0.1:54324`). Build and test the whole flow locally; only *production* verification needs task 08 |
| 12 toasts | No |
| 13 download button | No — its blocker (task 02) is done |
| 14 error boundaries | No |
| 15 legal pages | No. **Resolved 2026-09-14: personal project, no entity.** One thing still blocks writing it — the privacy policy must publish a contact **email address** for data requests. Prefer a project mailbox like `privacy@zeneratestudio.com` over a personal inbox, which needs the domain from task 09 |
| 16 duration constraints | No |
| **17 sound effects** | **Yes.** `scripts/create-sandbox-snapshot.ts` calls `Sandbox.create()`, which needs Vercel auth — a linked Vercel project. Needs task 09 to at least have run `vercel link` |
| 18 model upgrade | No — its blocker (task 01) is done |
| 18b public content signed out | No |
| 18c ESLint fix (issue #3) | No |

Phase 3 is similar: only task 24's *install verification* genuinely needs the HTTPS
origin from task 09. Everything up to that point is local.

**Recommendation:** you work Phase 1's account setup; hand Phase 2 to an agent starting
at task 12, 14, or 18c (all self-contained, no decisions needed from you). Converge at
task 09.

---

## What's left in Phase 1

Ordered by dependency. Each task file has full acceptance criteria — read it, don't work
from this summary.

### 06 — ElevenLabs production account
**Yours.** Subscribe to Starter. Then there's real agent work attached: `api/voices/route.ts`
filters `category === "premade"` against six hardcoded names, so **Voice Library voices
you add will not appear in the picker** until that filter changes. Also `voiceSettings`
is accepted by `generate-audio.ts` but never sent by `workflow.ts` — the plumbing exists
and is disconnected. Changing `generate-audio.ts` requires a snapshot rebuild.

Blocks task 03's verification (the cap of 25 was derived from this plan, not measured
against the live account).

### 07 — Production Supabase project
**Yours**, mostly. Agent can prepare the migration push and verify local/prod config parity.

Two criteria worth flagging: the `meditation-audio` bucket must be created **private with
no storage policies** — Phase 0's signing design depends on that, and adding storage
policies would break the reasoning (see PR #8's description). And **email confirmation
must be enabled**; without it, anyone can register unlimited unconfirmed accounts and farm
the per-user script quota, which is the entire defence task 01 just built.

### 08 — Transactional email
**Yours** for the account and DNS; agent can write templates. Do not rely on Supabase's
built-in sender — it is rate-limited to a handful per hour and not intended for production.
Resend is the default recommendation.

### 09 — Vercel deploy + domain
**Shared.** The repo goes **public** here. Before flipping visibility:
- Re-verify task 01's endpoint fix is still in place. This is the one where being wrong is unbounded — a public repo publishes the endpoint's exact shape.
- Audit history for committed secrets (good agent work: `git log --all -- .env.local`, scan for keys).

Resolved already: Vercel Sandbox on Hobby is not a capacity constraint. Still open: whether
Vercel **Workflow** (currently `^4.1.0-beta.60`) runs on Hobby — verify on first deploy, it
changes the cost model if not.

### 10 — Supabase keepalive + backups
**Agent work**, once 07 and 09 exist. A `/api/cron/keepalive` route guarded by
`CRON_SECRET`, a daily cron in `vercel.json`, and a documented `pg_dump` procedure. Run the
dump once before launch so a known-good restore path exists, and actually test a restore —
an untested backup is not a backup.

---

## Current state

- **Branch:** `keenanberry/feat-go-live-prep`, 15 commits, PR #8 open, CI green
- **First three commits are documentation** (design doc, task restructure, plan); code starts at `47df8bf`
- Working tree clean. Local Supabase runs; local dev server runs on :3000
- **Open issues:** #2–#7 from Phase 0. Only **#3 is pre-ship** (tracked as `18c`) — the ESLint rule guarding the audio-signing invariant matches literal specifier text, so a relative import bypasses it

### Key files Phase 0 touched

| File | Why it matters going forward |
|---|---|
| `src/lib/audio/signed-url.ts` | Signs with **service-role** and performs **no authorization**. Callers must hold a row already fetched through an RLS-bound client. An ESLint rule confines this module to `actions.ts` — do not widen it |
| `src/lib/meditation/actions.ts` | The only legitimate caller of the above. Six fetchers hydrate `audio_url` from `audio_path` |
| `src/lib/ai/quota.ts` | Script quota. Deliberately separate from `audio/quota.ts` — scripts are generated before a meditation row exists, so the audio ledger's `meditation_id not null` rules it out |
| `src/lib/audio/generate-audio.ts` | **Baked into the sandbox snapshot.** Editing it without `npx tsx scripts/create-sandbox-snapshot.ts` has zero runtime effect and looks like a code bug |

### Known-unverified

- **Anonymous audio access.** Signed-out visitors cannot reach any meditation page (task 18b), so Phase 0's signed-out cases were untestable. That verification is inherited by 18b — it is not "probably fine"
- **The live 503 on the global cap** was verified by parts, not end to end
- **Lock-screen audio.** Measured in real Chrome: there is no `<audio>` element in the document and `WaveSurfer.create({url})` passes no `media` option. Task 25 may be a wavesurfer reconfiguration before it is a Media Session task

---

## The exact next step

**If you're doing Phase 1 yourself:** subscribe to ElevenLabs Starter (task 06) and register
`zeneratestudio.com`. Those two unblock the most and only you can do them.

**If you want an agent moving in parallel right now:** hand it `tasks/ship/18c` (issue #3) —
self-contained, one-line change to `eslint.config.mjs`, needs no decision from you, and it
closes the last pre-ship gap from Phase 0. Then `tasks/ship/12` (toasts) or `14` (error
boundaries), both fully local.

**Do not** start task 17 (sound effects) or task 24's install verification until a Vercel
project exists.
