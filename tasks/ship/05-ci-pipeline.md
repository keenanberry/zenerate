# CI Pipeline

**Status:** Done
**Priority:** Ship-blocker
**Blocks:** 09 (should be green before the repo goes public)

## Why this blocks ship

There is no `.github/` directory. `vitest` and `eslint` are configured in `package.json`
and nothing runs them. The repo is about to become public and take its first outside
reader — a red or absent CI badge is the first signal anyone gets about whether the
project is maintained.

More practically: Phase 2 and Phase 3 touch a lot of files across separate sessions.
Without a gate, a broken typecheck can sit unnoticed until deploy.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` running on push to `main` and on pull requests
- [ ] Steps: install (`npm ci`), lint (`npm run lint`), typecheck (`npx tsc --noEmit`), test (`npm test`)
- [ ] Node version pinned to match local (`v24`) and Vercel's build image
- [ ] Dependency cache configured so runs stay under a minute
- [ ] Workflow is green on `main` before task 09 flips repo visibility
- [ ] `npm run build` included, or explicitly excluded with a reason — it catches a class of Next.js errors that `tsc` alone misses
- [ ] No secrets required. Anything needing `ANTHROPIC_API_KEY` / `ELEVENLABS_API_KEY` must not run in CI

## Implementation notes

- `npm run lint` is bare `eslint` in `package.json` — confirm it actually resolves the flat config in `eslint.config.mjs` with no args, or add an explicit path.
- `src/lib/audio/quota.test.ts` and `src/test/smoke.test.ts` are the current suite. Both should be hermetic; verify neither reaches for a live Supabase or a network call before wiring them into CI.
- A `build` step needs the `NEXT_PUBLIC_*` vars at build time. Supply dummy values via `env:` in the workflow rather than real ones — the build only needs them to be present and well-formed.
- Skip anything involving Vercel Sandbox or the snapshot; those are not CI-testable and `scripts/test-audio-generation.ts` is a manual integration script, not a unit test.

## Open questions

- Add a `.github/dependabot.yml`? Useful for a public repo, noisy for a side project. Default: skip for now, revisit if the repo attracts contributors.
