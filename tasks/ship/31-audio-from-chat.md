# Audio From the Chat

**Status:** In review (one real render left as an operator check)
**Priority:** Phase 4, Wave A. Seeding needs it.
**Phase:** 4 (studio)
**Depends on:** 28, 29. Builds cards against 30's `renderStudioPart`, so it can run beside 30.
**Blocks:** 32, 37
**Skills:** `zenerate-design`, `audio-pipeline` (read it, though nothing here should
touch the snapshot)
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

Make the audio without leaving the conversation: pick a voice, press one button, watch
it render, hear it inline.

## Scope

- **`tool-offerAudio` card** (`src/components/studio/audio-card.tsx`):
  - The voice picker reuses `voice-picker.tsx` and `/api/voices`. It also shows the
    estimated length and how many renders remain (`getQuotaUsage`; "unlimited" for an
    exempt operator).
  - It has a **Make audio** button. **Only the click starts a render.** The click posts
    to `/api/audio/generate`, then answers the tool with
    `addToolOutput({ started: true, voiceId })`.
- **Progress card, then the player:** once a render has started, the same card shows
  progress. Reuse `audio-processing-status.tsx`'s polling of `getMeditationStatus`, then
  render the player inline (`audio-player.tsx` with the signed URL from the existing
  hydrator) and a link to the meditation page.
- **The trigger route renders the draft:** when `draft_script` is not null,
  `/api/audio/generate` accepts a meditation in `completed` status as well as
  `script_ready`, and the workflow renders `draft_script`. *Promotion* and archiving on
  completion belong to 32. Until 32 lands, a completed draft render simply overwrites the
  current version (the "replace" behavior), which is acceptable for Wave A.
- **Operator exemption** (`src/lib/audio/quota.ts`): a new env var
  `QUOTA_EXEMPT_USER_IDS` (comma-separated). An exempt user skips both the per-user and
  the global cap, and their events are excluded from the global count. Add it to
  `.env.example` with a comment.
- Check `npm view workflow dist-tags` (per `CLAUDE.md`) and note the result in the PR.

## Interfaces

- Consumes `tool-offerAudio` from 29 and `renderStudioPart` from 30.
- Produces `AudioCard` and `isQuotaExempt(userId: string): boolean`, both exported for 32.

## Acceptance criteria

- [x] Quota tests:
  - An exempt user reserves past both caps.
  - A non-exempt user is still refused at 3.
  - An exempt user's events don't count toward the global total.
- [x] Route test: a `completed` meditation with a `draft_script` is accepted; a
  `completed` one without a draft still gets 409.
- [x] A double-clicked Make audio button creates exactly one reservation (the existing
  status guard returns 409 on the second click; the card disables the button on the
  first).
- [ ] End to end locally: chat, script, voice, Make audio, progress, then the inline
  player plays the new audio. *Verified locally up to `Sandbox.create`; the render itself
  is an operator check (see Outcome).*
- [x] The agent never starts a render on its own. Reading the code, confirm that the
  only caller of `/api/audio/generate` is the card's click handler and the meditation
  page's retry.
- [x] `docs/architecture.md` names the chat as the trigger.

## Outcome

### What changed

- **`AudioCard`** (`src/components/studio/audio-card.tsx`). Props are
  `{ part, chatId, meditationId: string | null, addToolOutput }`. The coordinator approved
  the required `addToolOutput` prop (the `useChat` helper) and relayed it to task 30, since
  `useStudio()` does not exist yet. The card's state comes from the meditation, not the
  message, so a reload restores it.
  - **Unanswered offer** (`input-available`): `VoicePicker` (the saved voice, or the
    default), the length ("Runs about 2 min"), the renders left ("2 of 3 renders left this
    month", or "Unlimited renders" for an exempt user), and **Make audio** and **Not now**.
    For a revision it says the new audio replaces the current audio.
  - **Make audio** posts to `/api/audio/generate`, and only after a 2xx does it answer the
    tool with `{ outcome: "started", voice }`. A ref guard plus the disabled state stop a
    second click in the same frame. **Not now** answers `{ outcome: "dismissed" }`. The
    output schema from 29 is unchanged.
  - **Processing**: `AudioProcessingStatus` (the same `getMeditationStatus` polling).
    **Completed**: the inline `AudioPlayer` with the URL from `getMeditationStatus`'s
    hydrator, plus "Open the meditation page". **Failed**: the free retry, when one is
    available.
  - A card that was already answered shows the audio it led to, never a second Make audio.
- **`getAudioOffer(meditationId)`** (`src/lib/audio/actions.ts`, a server action on the
  RLS-bound client) returns the status, whether a draft is pending, `canRender`, the length
  estimate of the script that would be narrated, the saved voice, the quota and the free
  retry event.
- **Route** (`src/app/api/audio/generate/route.ts`): with no retry, it accepts
  `script_ready`, or `completed` when `draft_script` is set. Anything else gets 409 before
  any reservation. A failed start puts the meditation back to the status it had (so
  `completed` for a draft), not always `script_ready`. **New:** the status flip is a
  compare-and-set (`.eq("status", <read status>)`). Of two requests that both pass the
  status check, only one flips the row, and the other refunds its reservation and gets 409.
  Before this, two truly concurrent requests could each reserve and each start a run.
- **Workflow** (`src/lib/audio/workflow.ts`): `fetchAndParse` narrates
  `draft_script ?? script`, and `finalize` writes `script = <rendered draft>,
  draft_script = null` in the same update as `completed` / `audio_path`
  (`updateMeditationStatus` takes an optional `extra`). A failed render leaves the draft in
  place. The workflow's arguments are unchanged, so an in-flight run from the previous
  deploy still finalizes normally.
- **Exemption** (`src/lib/audio/quota.ts`): `QUOTA_EXEMPT_USER_IDS` (comma-separated) and
  `isQuotaExempt(userId)`. It is done in TypeScript, so there is **no migration**. An exempt
  user reserves through the same RPC with caps it can never reach (retries are still
  validated). Every other user's global cap is raised by the exempt users' counted events
  this month, which takes those events out of the total. An exempt render that lands between
  that count and the RPC lowers someone's effective cap by one for that one request, which
  errs on the safe side. `getQuotaUsage` now returns `unlimited`, and the meditation page's
  `GenerateAudioPanel` honors it (it would otherwise block the operator at 3 while the route
  allowed them).
- **Prompt** (`src/lib/ai/prompts.ts`, one line): it said "never say audio is being made",
  so after the click the agent replied "Let me know if you'd like any tweaks before you
  generate it." The line now distinguishes before and after the click, and explains
  `started` and `dismissed`. Re-run result: "Your audio is being generated now, you'll see
  the progress and then the player right in the card." (Output schema `.describe()`
  strings are not sent to the model, which is why this is in the prompt.)
- `.env.example` and `docs/architecture.md` (a new "What Triggers a Render" section that
  names the chat as the trigger, plus the key files and the state machine).

**Not touched:** `generate-audio.ts`, `loudness.ts`, `scripts/sound-effects.ts`.
**The snapshot ID is unchanged** and no rebuild is needed.

**`npm view workflow dist-tags`** (2026-10-21): `latest 5.2.3`, `beta 5.0.0-beta.58`,
`previous 4.8.14`. Installed is 5.2.0 (`^5.2.0`), which is the current major, so no upgrade
is needed.

### Evidence

- `quota.test.ts`: an in-memory ledger whose `reserve_audio_generation` follows the SQL
  function's normal path. An exempt user reserves 8 against caps of 3 and 5, a non-exempt
  user is refused at the 4th, exempt events are left out of the global total, nobody is
  exempt when the variable is unset, and `unlimited` is set.
- **The same checks against the real RPC on local Postgres** (a throwaway script, not
  committed): with alice exempt holding 3 completed renders and the global cap at 3, alice
  reserved a 4th and bob reserved one. With the exemption off, both got
  `global_cap_reached`. The test rows were deleted afterwards.
- `route.test.ts` (new, 7 tests): `script_ready` is accepted; `completed` with a draft is
  accepted; `completed` without a draft gets 409 with no reservation; `processing_audio`
  (the second click) gets 409; losing the compare-and-set refunds and returns 409; a failed
  start reverts a draft render to `completed`; a retry from `completed` gets 409.
- `workflow.test.ts` (new, 3 tests): it narrates `draft_script` and not `script`, and
  promotes it on success; with no draft it narrates `script` and passes no extra; a failed
  render marks the meditation failed and does not touch the draft.
- **Live, local Supabase + `next dev`, signed in as alice, through an uncommitted harness
  page** that renders `useChat` with `sendAutomaticallyWhen:
  lastAssistantMessageIsCompleteWithToolCalls` and the real `AudioCard`:
  - A chat ("2 minute breathing meditation") ran `writeScript`, `setDetails` and then the
    card. **Before the click, the tab had no `/api/audio` request.**
  - A **double-click** on Make audio made **one** `POST /api/audio/generate` (202), then the
    `/api/chat` continuation, then the progress card.
  - The run then failed at `Sandbox.create` (see below). Its event was marked `failed`, so
    it was not charged, and the card switched to the failed state with "Retry — free". The
    retry posted `retryOfEventId`, and a free-retry event was created.
  - Same meditation set to `completed` + `audio_path` and no draft: 409. With a draft: 202.
    **Two concurrent POSTs** (`Promise.all`) gave 202 and 409 ("Audio is already being made
    for this meditation."), and the loser's event was refunded. After the Sandbox failure
    the meditation was `failed` with `draft_script` still set.
  - With `QUOTA_EXEMPT_USER_IDS` set to alice's id, the card read "Unlimited renders", and
    the agent's continuation used the new prompt line.
  - Design, dark desktop, then dark at 390 px (in a 390 px iframe, because the Chrome window
    would not resize): the actions stack with Make audio full width, and there is no
    horizontal scroll (`scrollWidth` 388 = `clientWidth`). Then light. Impeccable detect on
    the changed components: `[]`.
- **Why no real render:** the local Sandbox needs a Vercel OIDC token. `.env.local` has
  none, and its `VERCEL_TOKEN` is the known-invalid one. The Vercel CLI on this Mac is
  signed into a different account, so `vercel env pull` returns "Not authorized". The
  coordinator chose to ship with the render as an operator check. Nothing reached
  ElevenLabs, and no credits were spent.
- `grep '"/api/audio/generate"' src` finds three callers, all click handlers: the card's
  Make audio and free retry, the meditation page's Generate panel and its free retry. The
  agent's `offerAudio` has no `execute`.

### Decisions and notes for 32

- **A failed draft render sets `failed`**, the existing state machine, so the free retry
  works. On a public meditation, the page then shows no player to others until a render
  succeeds, even though the old audio still exists. Wave A is operator-only, so this is
  acceptable now. 32 should restore the current version on failure once versions exist.
- **`settings.duration` and `settings.type` are not updated when a draft is promoted.**
  `setDetails` leaves them alone once audio exists, and nothing stores the draft's target.
  32's promotion should carry them.
- The replaced audio is upserted to the same `<id>.mp3`. A signed URL minted before the
  re-render could serve a cached copy until it expires.
- An unanswered offer from earlier in a chat stays actionable after a reload. A click there
  starts a render and answers that older tool call client-side. That is harmless, and it
  goes away when 30 shows only the latest offer, if it chooses to.

### For the operator

- **One real render from the chat** on a preview or production deploy: chat → script →
  pick a voice → Make audio → progress → the inline player plays the new audio. Then ask
  for a revision, Make audio again, and confirm the new audio replaced the old and the page
  shows the revised script.
- Set **`QUOTA_EXEMPT_USER_IDS`** in Vercel (Production and Preview) to your auth user id,
  then redeploy. Without it, you are capped at 3 like everyone else.
- No migration, and no snapshot rebuild (`AUDIO_SANDBOX_SNAPSHOT_ID` unchanged).
- To run renders locally, `.env.local` needs a `VERCEL_OIDC_TOKEN` from
  `vercel env pull --environment=development`, run from the account that owns the project.
