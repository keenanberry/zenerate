# Vercel Deploy Setup

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 07 (prod Supabase for env vars), 08 (email)

## Why this blocks ship
The app must be deployed to Vercel so users can access it. Vercel Workflow and Sandbox also only run in Vercel's environment — local dev can invoke them, but durable production orchestration needs a deployed app.

## Constraints
- The repo must be **public** on GitHub due to Vercel account limitations with the user's work account + GitHub account pairing.
- Before flipping visibility, verify no secrets have been committed (`.env.local`, `.vercel/`, any keys in old commits).

## Acceptance criteria
- [x] Repo audited for committed secrets — nothing sensitive in history. **Audited 2026-09-15 against `810564c`:** `.env.local`/`.env`/`.env.production`/`.vercel` never committed on any branch; every blob in all history scanned for `sk-ant-`, `sk_`, `ghp_`, `github_pat_`, `AKIA`, `xoxb-` and PEM private-key headers — zero hits; the only JWT in history decodes to `{"iss":"supabase-demo","role":"anon"}`, the published local-dev key. CI uses dummy env values, no real secrets. `seed.sql` carries the task-04 production guard and its `password123` users are local-only (task 07 creates a fresh prod project, so no such rows exist there)
- [x] Task 01's endpoint fix re-verified still in place (the unbounded-risk item, since a public repo publishes the endpoint's exact shape): `src/app/api/generate/route.ts` gates auth at :21 → validates type/emptiness/`MAX_PROMPT_CHARS` at :28-39 → reserves quota at :41 with 429/503 → only then calls Anthropic at :60, capped at `maxOutputTokens: 8000`
- [ ] Repo made public on GitHub
- [ ] `vercel link` run locally to bind this repo to the Vercel project
- [ ] Vercel project created and connected to the GitHub repo
- [ ] All env vars set in Vercel (Production + Preview): Supabase keys, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `AUDIO_SANDBOX_SNAPSHOT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`
- [ ] Sandbox snapshot rebuilt against prod context if needed (should be same snapshot as dev)
- [ ] First deploy succeeds and landing page loads
- [ ] Sign up + sign in work in production
- [ ] End-to-end: create meditation → generate script → generate audio → play audio all work in prod
- [ ] `zeneratestudio.com` registered and linked as the custom domain
- [ ] `NEXT_PUBLIC_SITE_URL=https://zeneratestudio.com` set in Vercel (Production) and in `.env.example`
- [ ] Supabase auth redirect allowlist updated for the production domain (ties to task 07)

## Implementation notes
- `.gitignore` already excludes `.env.local` — verify with `git log --all -- .env.local`.
- Make sure `AUDIO_SANDBOX_SNAPSHOT_ID` in Vercel matches a snapshot that's still valid (`expiration: 0` means permanent).
- `NEXT_PUBLIC_SITE_URL` is **not referenced anywhere in `src/` yet** — the auth callback derives its redirect from the request's own `origin`, so it self-adapts to whatever domain serves it. The variable becomes load-bearing at task 08, when email templates need an absolute URL. Set it, but know nothing reads it today.
- Vercel Workflow requires the `workflow` package config to match the deploy. Verify it ships cleanly.
- Add `NEXT_PUBLIC_SITE_URL` or equivalent if any code constructs absolute URLs (check email reset URL generation once task 08 is in).

## Resolved
**Sandbox capacity on Hobby is not a constraint.** Hobby includes 5 Active-CPU-hours/month, 420 GB-hours provisioned memory, 5,000 creations, 10 concurrent sandboxes, and a 45-minute max session. Our sandbox runs 2 vCPU for ~5 minutes and is mostly I/O-wait on ElevenLabs, which is not billed as Active CPU. That works out to roughly 300 generations/month — about 10x the ElevenLabs Starter ceiling of ~32. ElevenLabs runs dry long before Vercel does. Exceeding Hobby quotas pauses sandbox creation rather than incurring charges.

## Open questions
- **Vercel Workflow plan gating is unconfirmed.** The `workflow` package is at `^4.1.0-beta.60`; whether durable workflows run on Hobby was not verified. Check on first deploy — if it needs Pro, that changes the cost model.
- Vercel Hobby prohibits commercial use. Fine while the app is free; the post-ship paid tier would require Vercel Pro.
