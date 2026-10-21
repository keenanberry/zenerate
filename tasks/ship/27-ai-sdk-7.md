# AI SDK 7 Upgrade

**Status:** Not started
**Priority:** Phase 4, Wave A. First, so no chat code starts on a superseded major.
**Phase:** 4 (studio)
**Depends on:** nothing
**Blocks:** 29, 30, 31
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

The repo is on `ai` 6.0.x, `@ai-sdk/react` 3.x and `@ai-sdk/anthropic` 3.x. On
2026-10-20, `ai@latest` was 7.0.x and `@ai-sdk/react@latest` 4.0.x. The chat is a
rewrite of generation, and starting it on the old major means a migration later on top
of new code.

## Scope

- Bump `ai`, `@ai-sdk/react` and `@ai-sdk/anthropic` to their current majors. Run
  `npm view <pkg> dist-tags` first and record the versions in the PR.
- Migrate today's call sites: `src/app/api/generate/route.ts`,
  `src/components/meditation-form.tsx` (`useCompletion`) and
  `scripts/measure-script-duration.ts`. 29 and 30 delete the first two, but `main`
  must stay green in between.
- Confirm the v7 equivalents of what 29 depends on, and record them in the Outcome for
  29 and 30 to use: fine-grained tool-input streaming, the `input-streaming` tool-part
  state and partial `part.input`, `toUIMessageStreamResponse({ originalMessages,
  generateMessageId, onFinish })`, `validateUIMessages`, `convertToModelMessages`,
  `consumeStream`, client-side tools with `addToolOutput`, and transient data parts.

## Acceptance criteria

- [ ] `npm run lint`, `typecheck`, `test` and `build` pass, and CI is green.
- [ ] Generate a script locally through the existing form. It still streams.
- [ ] The lockfile is generated with the project `.npmrc` in place (see the
  `npmrc-legacy-peer-deps` note). Only the AI SDK packages and their dependencies change.
  No unrelated npm 11 churn.
- [ ] The Outcome lists each v6→v7 API name change 29 and 30 need.

## Notes

- The installed v6 docs are in `node_modules/ai/docs/`. After the bump, read the v7
  copies there rather than the web, so the API matches the installed version exactly.
