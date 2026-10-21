# AI SDK 7 Upgrade

**Status:** Done (PR #50)
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

- [x] `npm run lint`, `typecheck`, `test` and `build` pass, and CI is green. (Local runs pass; CI is checked on the PR.)
- [x] Generate a script locally through the existing form. It still streams.
- [x] The lockfile is generated with the project `.npmrc` in place (see the
  `npmrc-legacy-peer-deps` note). Only the AI SDK packages and their dependencies change.
  No unrelated npm 11 churn.
- [x] The Outcome lists each v6→v7 API name change 29 and 30 need.

## Notes

- The installed v6 docs are in `node_modules/ai/docs/`. After the bump, read the v7
  copies there rather than the web, so the API matches the installed version exactly.

## Outcome

### Versions

`npm view <pkg> dist-tags` on 2026-10-21 showed these `latest` versions, now installed:

| Package | Before | After |
|---|---|---|
| `ai` | 6.0.97 | 7.0.148 |
| `@ai-sdk/react` | 3.0.99 | 4.0.152 |
| `@ai-sdk/anthropic` | 3.0.46 | 4.0.85 |

The lockfile was written by `npm install <pkg>@^<ver>` with the project `.npmrc`
(`legacy-peer-deps`) in place. The diff is 155 lines, and every change comes from these
three packages. It moves the `@ai-sdk/*` internals (`provider` 4.0.31, `provider-utils`
5.0.65, `gateway` 4.0.121) and adds `@ai-sdk/mcp` (a new dependency of
`@ai-sdk/react`). It also pulls in a nested `@workflow/serde` 4.1.0 under `provider-utils`
and bumps `eventsource-parser` and `swr`. `@opentelemetry/api` is removed, because v7 moved
telemetry to `@ai-sdk/otel`. `@vercel/oidc` rises to 3.2.0, so its two nested copies
dedupe away. `pkce-challenge` loses `dev: true` now that `@ai-sdk/mcp` uses it at runtime.

### Call-site migration

- `src/app/api/generate/route.ts`: `system` → `instructions`, and the deprecated
  `result.toTextStreamResponse()` → `createTextStreamResponse({ stream: result.textStream })`.
  In the installed source, the old method was exactly this call, so the response is
  byte-for-byte the same (`text/plain; charset=utf-8`, text deltas only). The test mocks the
  new helper and adds a case that pins `instructions` and the absence of `system`. That case
  fails if the route goes back to `system`, which v7 still accepts as a deprecated fallback
  and so would not fail typecheck.
- `scripts/measure-script-duration.ts`: `system` → `instructions`, keeping it the same as the
  route. `result.textStream` is unchanged in v7.
- `src/components/meditation-form.tsx`: **no change needed.** In `@ai-sdk/react` 4,
  `useCompletion` keeps `api`, `streamProtocol: "text"`, `onError`, `completion`,
  `isLoading` and `complete`. Only `experimental_throttle` is deprecated, and the form does
  not use it.
- The thinking config (`providerOptions.anthropic.thinking: { type: "adaptive" }`,
  `effort: "low"`) is unchanged. v7 adds a portable top-level `reasoning` option, but
  provider options take precedence and omitting `reasoning` means the provider default, so
  behavior is the same.

### Evidence

- `npm run lint` (0 errors, 3 warnings that are already on `main`), `npx tsc --noEmit`
  (CI's typecheck step; the repo has no `typecheck` script), `npm test` (273 passed) and
  `npm run build` all pass.
- Local generation via `/create` (alice, Morning Calm template, 10 min): `POST /api/generate`
  returned 200 and arrived in **146 chunks**. The first chunk came at about 0 ms after headers
  and the last at 7.2 s, so the stream is incremental, not buffered. The script rendered
  progressively and finished with the closing sound cue. The dev server logged no
  deprecation warnings.

### v7 API names for tasks 29 and 30

Checked against `node_modules/ai/docs/` (including
`08-migration-guides/23-migration-guide-7-0.mdx`), `node_modules/@ai-sdk/anthropic/docs/`
and the installed `.d.ts` files.

| What 29/30 need | v7 name / shape | Notes |
|---|---|---|
| Fine-grained tool-input streaming (Anthropic) | On by default. `providerOptions.anthropic.toolStreaming` (default `true`) | No beta header or opt-in needed. Set `false` only to turn it off. |
| Partial input while streaming | Tool UI part `state: 'input-streaming'` with `input: DeepPartial<INPUT> \| undefined` | Unchanged from v6. Then `input-available` → `output-available` / `output-error` (plus `approval-requested` / `approval-responded`). Guard `part.input?.script` because `input` can be `undefined`. Server-side hooks on `tool()`: `onInputStart`, `onInputDelta`, `onInputAvailable`. |
| `result.toUIMessageStreamResponse({ originalMessages, generateMessageId, onFinish })` | **Deprecated.** Use `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, originalMessages, generateMessageId, onEnd }), consumeSseStream? })` | Both helpers are top-level imports from `ai`. In `toUIMessageStream` options, **`onFinish` → `onEnd`** (`onFinish` is a deprecated alias) and `onStepFinish` → `onStepEnd`. `onEnd` gets `{ messages, isAborted, ... }`. |
| Full event stream | `result.stream` (was `result.fullStream`, now a deprecated alias) | Pass `result.stream` into `toUIMessageStream`. |
| `validateUIMessages` | Same name: `validateUIMessages({ messages, tools, dataSchemas, metadataSchema })` | Async. `safeValidateUIMessages` also exists. |
| `convertToModelMessages` | Same name, still async: `await convertToModelMessages(messages)` | v7 **rejects `role: 'system'` messages** in `messages`/`prompt` by default. Put the system prompt in `instructions`. |
| System prompt | `instructions` (was `system`, a deprecated fallback) | Also applies to `prepareStep` return values. |
| `consumeStream` | Two forms: `result.consumeStream()` (no await) so persistence runs after a client disconnect, and the top-level `consumeStream` passed as `createUIMessageStreamResponse({ consumeSseStream: consumeStream })` for abort handling | Both documented in `04-ai-sdk-ui/03-chatbot-message-persistence.mdx` and `06-advanced/02-stopping-streams.mdx`. |
| Client-side tools | `useChat` → `addToolOutput({ tool, toolCallId, output })` or `{ state: 'output-error', errorText }`, with `onToolCall` and `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` | `addToolResult` is a deprecated alias. Call `addToolOutput` without `await` inside `onToolCall`. Check `toolCall.dynamic` first. |
| Transient data parts | `writer.write({ type: 'data-<name>', data, transient: true })` inside `createUIMessageStream({ execute: ({ writer }) => ... })`. Read on the client via `useChat({ onData })` | Not added to message history, so it is only visible in `onData`. Merge model output with `writer.merge(toUIMessageStream({ stream: result.stream }))`. |
| Step limit | `stopWhen: isStepCount(n)` (was `stepCountIs`, now a deprecated alias). Default is still `isStepCount(1)` | A multi-step tool loop must set `stopWhen`. |
| Result shape | `result.usage` now sums all steps (`totalUsage` is deprecated). `response`, `reasoning` and `providerMetadata` moved to `result.finalStep`. Use `result.responseMessages` for the full history, because `step.response.messages` is now per-step | Matters if 29 meters tokens or persists from the `streamText` result rather than from `onEnd`. |
| `streamText` `onFinish` / `onStepFinish` | `onEnd` / `onStepEnd` | Deprecated aliases remain. |

### For the operator

- v7 requires **Node 22+**. CI uses Node 24. Confirm the Vercel project's Node version is 22.x
  or 24.x before this deploys. It must not be 20.x.
- After deploy, generate one script on production through `/create` and confirm it streams.
