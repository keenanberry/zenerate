# Model Comparison for the Studio Agent: Sonnet 5, Sonnet 5.5, Haiku 5.5

**Status:** Done, in review. Production stays on `claude-sonnet-5` until the operator decides.
**Priority:** Phase 6. Decide before signups open; the free tier's cost depends on it.
**Phase:** 6 (seed & open)
**Depends on:** 29 (chat agent), 41 (cap rewrites), 43 (next step after draft)
**Closes:** GitHub issue #19

## Why

The studio runs `claude-sonnet-5` (`src/app/api/chat/route.ts`). The operator asked whether
to move to `claude-sonnet-5-5`, which costs the same ($2 / $10 per MTok) and is newer. Cost
matters too: `tasks/post-ship/paid-tier.md` estimated Anthropic at $0.15–0.30 per
meditation. `claude-haiku-5-5` is $0.10 / $0.50 per MTok, about 20 times cheaper, and could
make the free tier cheap if its scripts are good enough.

Issue #19 predates the studio: it points at the retired `/api/generate` route and asks for
a 3 × 3 that included Sonnet 4.6 and Opus. This task replaces that with the three models the
operator asked about, measured through the studio's real prompt, tools and settings. Opus was
not measured.

## Method

- **One place for the model.** `src/lib/chat/model.ts` holds the model (`STUDIO_MODEL`
  overrides the `claude-sonnet-5` default), its provider options, prices and a usage log
  line. The route and the measurement script both read it, so a measurement runs what
  production runs.
- **`scripts/measure-studio-rewrites.ts`, extended.** It now keeps history as UI messages,
  JSON round trip included, and converts it the way the route does
  (`convertToModelMessages` with `ignoreIncompleteToolCalls`). So an answered audio card is
  replayed as a real continuation (the stored last assistant message replaced, as
  `isContinuation` does). Per turn it records token usage and cost from `streamText`'s
  `totalUsage`, the time to the first script character in the canvas and to the first chat
  text, rejected tool inputs, malformed markers, unknown sounds, `inputTransformations`, and
  a summary of every request on the wire (status, `anthropic-beta`, `thinking`,
  `output_config`, `tool_choice`, tool names, `fallbacks`, the block types of each message).
  It also saves scripts for reading.
- **Every turn ran with the history check on.** `--bind error` sends
  `thinking.block_binding.prefix_mismatch_behavior: "error"`, which opts this (older)
  account into the preserved-thinking check, so any history edit is a 400 instead of
  passing silently.
- **Runs per model:** 2 samples of the 10-min unwind plus "Make the middle longer", 20-min
  body scan, 30-min breath, the two "Make the audio" flows, and three emotional requests
  (5-min interview nerves, 10-min job loss, 20-min grief); 1 sample of the Python request,
  the injection attempt, the full continuation flow (draft → "Make the audio" → card
  answered → revision) and the unanswered-card flow; then 2 samples of a draft and card in
  one message followed by a continuation. That is 31 turns plus 6 continuation turns per
  model.

**Total spent: about $2.06** across every run, including smoke tests and one discarded run
(the script first counted recoverable tool errors as fatal).

## Results

### Migration checks (claude-api skill, "Migrating to Claude Sonnet 5.5 / Haiku 5.5")

| Check | Finding |
|---|---|
| **Thinking** | All three are sent `thinking: {"type":"adaptive"}` with `output_config: {"effort":"low"}`. Nothing sends `disabled`, which is a 400 on Sonnet 5.5. |
| **Forced tool choice** | On the wire `tool_choice` is only ever `{"type":"auto","disable_parallel_tool_use":true}`, or `{"type":"none"}` on a turn's fifth step. Nothing forces a tool. `@ai-sdk/anthropic` 4.0.85 would downgrade a forced `tool` choice to `auto` with **only that tool sent** on Sonnet 5.5, which trips the history check below, so don't add one. |
| **Effort** | `low` on all three, set explicitly. Haiku 5.5 would otherwise default to `medium`. At `low`, Sonnet 5.5 rarely thinks (median 0 reasoning tokens per first draft). Haiku 5.5 still thinks about 880 tokens before writing. |
| **Refusals** | **None in 111 turns**, including grief (a mother's death), job loss and pre-interview panic: 6 of 6 complete scripts on every model. `fallbacks: "default"` is supported by `@ai-sdk/anthropic` (it adds `server-side-fallback-2026-07-01` itself). It now goes to Sonnet 5.5 only, and the API accepts it there. Haiku 5.5 has no server-side fallback, and Sonnet 5 is the fallback target. |

### Preserved thinking and the continuation

**Found and fixed: "Make the audio" was a history edit on Sonnet 5.5 and Haiku 5.5.**
Task 43's `prepareStudioStep` narrows the first step after "Make the audio" with
`activeTools: ["offerAudio"]`, so that request's `tools` list is one tool, not four. Every
thinking block made earlier in the chat was signed with four tools. With the check on,
Haiku 5.5 rejected the turn:

```
400 messages.1.content.0: Invalid `signature` in `thinking` block. The block is bound to a
different conversation. ... The `tools` list differs from the one this block was created with.
anthropic-thinking-prefix-mismatch: kind=tools_changed; pattern=tool_set_changed; sections=tools
```

Sonnet 5 accepts the same request (200), and Sonnet 5.5 passed only because it had not
thought on the earlier turns. Without `--bind`, this account does not enforce the check
(it predates 2026-08-31), but a new account would get the 400 on every "Make the audio".
The fix: `prepareStudioStep(step, { narrowTools })`. `narrowsToolsForAudio(model)` keeps
narrowing on Sonnet 5 only. On Sonnet 5.5 and Haiku 5.5 the tool list stays fixed and the
prompt alone steers, and "Make the audio" still gave only the card in 6 of 6 on each.
`tool_choice` is not part of the check: a forced `none` step after thinking blocks returned
200 with the check on.

**The continuation is not an edit, and reasoning survives the round trip.** The reasoning
parts keep their signatures through `toUIMessageStream` → JSON (as in `chat_messages`) →
`convertToModelMessages`. Local `chat_messages` rows from real use show the same thing, for
example a continued message with reasoning, then `tool-offerAudio` with output available.
When the card is answered, the continued message is replayed as
`assistant:thinking+tool_use … assistant:tool_use user:tool_result`: the old blocks
unchanged, plus a new tool result. That is append-only. The draft-and-card-in-one-message
continuation, whose continued message carries the draft's thinking blocks, returned 200 on
all three, 2 of 2 each, with the check on.

| | Sonnet 5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Requests with the check on | 90 | 87 | 91 |
| …that replayed thinking blocks | 65 | 20 | 69 |
| 400s / blocks dropped (`inputTransformations`) | **0 / 0** | **0 / 0** | **0 / 0** |

### Behaviour, accuracy, cost and speed (31 turns per model)

| Check | Sonnet 5 (today) | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Task 29: "10 minutes to unwind" writes first, no question | 2/2 | 2/2 | 2/2 |
| Task 29: Python request and injection get the one-line decline, no tools | 2/2 | 2/2 | 2/2 |
| Task 29: "Make the middle longer" keeps the 10-min target | 10.2, 9.9 | 9.1, 11.0 | 9.6, 9.7 |
| Task 34: unprompted `previewSounds` | 0 | 0 | 0 |
| Task 43: first drafts hand off (text last, no card) | 18/18 | 18/18 | 18/18 |
| …as a question | 15/18 | 17/18 | 12/18 |
| Task 43: "Make the audio" gives only the card | 6/6 | 6/6 | 6/6 |
| Task 41: writes per script turn | 1.23 (4 of 22 twice) | 1.27 (6 of 22) | 1.32 (6 of 22) |
| Final length vs 5 min | 4.5–6.1 | 5.0–5.5 | 4.5–5.6 |
| vs 10 min | 9.1–11.9 | 9.0–11.3 | 9.6–11.0 |
| vs 20 min | 20.0–22.1 | 19.0–22.3 | 18.8–20.3 |
| vs 30 min | 28.9–29.1 | 27.3–27.7 | 28.7–29.2 |
| Finals outside tolerance (2 min or 15%) | 0 | 0 | 0 |
| Malformed markers flagged by `writeScript` / left in final scripts | 2 / 0 | 6 / 0 | 9 / 0 |
| Unknown sounds | 0 | 0 | 0 |
| `setDetails` input rejected, then retried | **4** (unquoted `"tags": breathwork,focus`, invalid JSON) | 0 | 1 (off-vocabulary tag `mindfulness`) |
| Refusals | 0 | 0 | 0 |
| First canvas text, median / max | 1.5 / 2.5 s | 1.2 / 3.7 s | **4.4 / 9.6 s** |
| First-draft turn, median / max | 11.5 / 22.2 s | 9.9 / 18.3 s | 9.7 / 20.2 s |
| First draft, median cost | $0.018 | $0.021 | $0.0015 |
| Revision, median cost | $0.037 | $0.023 | $0.0014 |
| Full flow: draft → audio → card → revision | $0.108 | $0.053 | $0.0045 |

Costs are on a warm prompt cache. The first turn after five idle minutes writes about 4.4k
cached tokens: +$0.011 on Sonnet, +$0.0005 on Haiku.

Sonnet 5's revisions cost more because it thinks more on them (211 reasoning tokens against
0 on Sonnet 5.5, in the full flow) and re-reads more history. Haiku 5.5's slower first
canvas is its thinking: about 880 tokens before the script starts streaming.

### Reading the scripts

Saved under `test-output/model-comparison/<model>/` (git-ignored):
`05min-interview-nerves.md`, `10min-job-loss.md`, `20min-grief.md`, and the other runs'
final scripts in `other/`. My read of the grief script: all three are safe, kind and
correctly formatted. Sonnet 5's is the most personal ("Grief is love with nowhere to go
tonight", "Her love made you. That part is permanent."). Sonnet 5.5's is warm and well paced,
with a hand-on-heart and loving-kindness arc. Haiku 5.5's is sound but generic, and it closes
a bedtime grief meditation with "Wiggle your fingers and toes... open your eyes". Haiku's
closing lines are also formulaic: "I've written a … It runs about …, so you can …", and
once "a 5-minute practice … runs about 6 minutes", which the prompt asks it not to say. In
the unanswered-card flow, it once called `offerAudio` unasked after a revision and ended on
the card with no line. The operator should judge the scripts by eye.

## Recommendation

1. **Move production to Sonnet 5.5, after the operator reads the scripts.** It costs the
   same per token and about half as much per meditation in this flow. Its tool inputs never
   failed (Sonnet 5's `setDetails` JSON failed 4 times in 31 turns, each costing a retry
   step). Its hand-off lines are the best of the three, and its first canvas text is a little
   faster. The one thing to watch: 30-minute scripts land at 27–28 min, inside tolerance but
   short. The switch is `STUDIO_MODEL=claude-sonnet-5-5` in Vercel plus a redeploy, with no
   code change. This PR already carries the tool-list fix it needs.
2. **Haiku 5.5 is a credible free-tier model, not a replacement.** It passes every
   functional check at about a twentieth of the cost (half a cent per meditation). It writes
   flatter, more formulaic prose and needs more self-corrections, and the canvas starts 3 s
   later on median. Using it for free users and Sonnet 5.5 for paid needs per-user model
   routing, which isn't built. Upgrading a chat from Haiku 5.5 to Sonnet 5.5 keeps its
   reasoning on the Claude API; going the other way drops the blocks silently, with no error.
3. **Winner, for issue #19:** Sonnet 5.5. It matches Sonnet 5 on every check, at half the
   cost per meditation, with no malformed tool input. Do not re-run the old 3 × 3; the route
   it measured is gone.

## Acceptance criteria

- [x] All three models measured on every row above (none stopped early)
- [x] Preserved-thinking and continuation question answered with evidence: one real 400
      found and fixed; 0 400s in 268 requests with the check enforced afterwards
- [x] Model id is one constant with an env override (`STUDIO_MODEL`); default stays
      `claude-sonnet-5`
- [x] Measurement script extended (usage, cost, latency, wire summary, continuation,
      `--bind`, `--save-scripts`)
- [x] Usage logging kept: the route logs `[chat] usage {...}` per turn
- [x] `paid-tier.md`'s cost section uses the measured numbers
- [x] Lint, tsc, tests and build pass

## Outcome

### What changed

- **`src/lib/chat/model.ts`** (new): `STUDIO_MODELS`, `studioModel()` (reads
  `STUDIO_MODEL`; an unknown value warns and falls back rather than failing every turn),
  `studioProviderOptions(model)` (adaptive thinking, low effort, one tool per step, and
  `fallbacks: "default"` on Sonnet 5.5 only), `narrowsToolsForAudio(model)`, `usageCost`
  and `usageLogLine`. Tests are in `model.test.ts`.
- **`src/app/api/chat/route.ts`**: reads the model and options from there, passes
  `narrowTools` to `prepareStudioStep`, and logs `[chat] usage` from `streamText`'s `onEnd`.
  On Sonnet 5 the request body is unchanged, apart from the new log line.
- **`src/lib/chat/tools.ts`**: `prepareStudioStep` takes `{ narrowTools }` (default
  `true`, as before). There's a new test for `false`.
- **`scripts/measure-studio-rewrites.ts`**: rewritten as described in Method. The scenario
  list grew to 13. The model comes from `STUDIO_MODEL`, the same override the route uses.
- **`.env.example`**: documents `STUDIO_MODEL`.
- **`tasks/post-ship/paid-tier.md`**: Anthropic cost per turn and per meditation for all
  three models, the corrected total and chat-ceiling exposure, and the usage log.

### Decisions

- **Narrowing stays on Sonnet 5**, so production behaves exactly as before. Dropping it
  everywhere would be simpler, but task 43's 10-of-10 was measured with it, and the brief
  says not to change production in this PR.
- **The fallback goes to Sonnet 5.5 only.** The skill documents only the `"default"` form
  for Sonnet 5.5, and Haiku 5.5 has no server-side fallback. It was never triggered, so
  its routing is untested beyond the request being accepted.
- **No hand-rolled fetch**: everything goes through `@ai-sdk/anthropic` 4.0.85.

### For the operator

- Read the nine scripts in `test-output/model-comparison/` and decide. To switch
  production, set `STUDIO_MODEL=claude-sonnet-5-5` in Vercel and redeploy.
- Sonnet 5.5 has its own rate-limit pool. Check the tier's Sonnet 5.5 limits in the
  Anthropic console before switching.
- If production's API key belongs to an organization created on or after 2026-08-31, the
  history check is enforced there. This PR makes that safe on Sonnet 5.5 and Haiku 5.5.
- After a few days of real traffic, sum the `[chat] usage` log lines in Vercel to replace
  the warm-cache estimates in `paid-tier.md`.
