# Vercel Deploy Setup

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 01 (prod Supabase for env vars)

## Why this blocks ship
The app must be deployed to Vercel so users can access it. Vercel Workflow and Sandbox also only run in Vercel's environment — local dev can invoke them, but durable production orchestration needs a deployed app.

## Constraints
- The repo must be **public** on GitHub due to Vercel account limitations with the user's work account + GitHub account pairing.
- Before flipping visibility, verify no secrets have been committed (`.env.local`, `.vercel/`, any keys in old commits).

## Acceptance criteria
- [ ] Repo audited for committed secrets — nothing sensitive in history
- [ ] Repo made public on GitHub
- [ ] `vercel link` run locally to bind this repo to the Vercel project
- [ ] Vercel project created and connected to the GitHub repo
- [ ] All env vars set in Vercel (Production + Preview): Supabase keys, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `AUDIO_SANDBOX_SNAPSHOT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`
- [ ] Sandbox snapshot rebuilt against prod context if needed (should be same snapshot as dev)
- [ ] First deploy succeeds and landing page loads
- [ ] Sign up + sign in work in production
- [ ] End-to-end: create meditation → generate script → generate audio → play audio all work in prod
- [ ] Custom domain linked (if applicable)

## Implementation notes
- `.gitignore` already excludes `.env.local` — verify with `git log --all -- .env.local`.
- Make sure `AUDIO_SANDBOX_SNAPSHOT_ID` in Vercel matches a snapshot that's still valid (`expiration: 0` means permanent).
- Vercel Workflow requires the `workflow` package config to match the deploy. Verify it ships cleanly.
- Add `NEXT_PUBLIC_SITE_URL` or equivalent if any code constructs absolute URLs (check email reset URL generation once task 08 is in).

## Open questions
- Does the Vercel team plan support concurrent sandboxes at expected load?
