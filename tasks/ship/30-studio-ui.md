# Studio UI: Chat + Script Canvas

**Status:** Done (PR open, awaiting review)
**Priority:** Phase 4, Wave A
**Phase:** 4 (studio)
**Depends on:** 29 (its Interfaces block; can start against those types once 29's
`tools.ts` is merged)
**Blocks:** 32, 34
**Skill:** `zenerate-design`, verified dark first, then light, then phone width
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

Replace the wizard with one input, and the editor with the conversation. Keep what the
operator loves: the script forming before your eyes in its clearly separated sections.
Fix what they don't: the view pinned at the top while the text runs off the page.

## Scope

- **Routes:** `/create` is a single large input with "Recent" drafts below it, from
  `listDraftChats`. Sending calls `createChat`, routes to `/create/[chatId]` and sends the
  first message. `/create/[chatId]` loads `getChat` and hydrates `useChat({ id, messages })`.
  Both are under `(authed)`.
- **Layout:** on desktop, chat on the left and the canvas on the right. Under the `md`
  breakpoint, the chat fills the screen and the canvas is a sheet. A "Script updated"
  pill appears in the chat whenever the canvas changes; tapping it opens the sheet.
- **Canvas** (`src/components/studio/script-canvas.tsx`):
  - Renders the newest `tool-writeScript` part's script with the existing `ScriptViewer`
    section styling. While the part is `input-streaming`, it renders the partial
    `part.input.script`.
  - **Follows the stream:** it auto-scrolls to the newest line until the reader scrolls
    up, and resumes following when they return to the bottom.
  - Shows the title and tags from the latest `setDetails` above the script.
  - Shows the duration estimate from the tool result, flagged when it is more than 10%
    off the target.
- **Chat:** assistant text and tool parts in order. `tool-writeScript` renders in the
  chat as a compact "Draft 2 · 10 min" chip, not the script, and tapping it focuses the
  canvas. Tool parts that belong to 31 render through a `renderStudioPart(part)` switch
  in `src/components/studio/parts.tsx`, which 31 fills in.
- **Errors:** a 429 or a stream error shows inline with a retry. A reload mid-stream
  shows the last saved state; a partially streamed script is never presented as saved.
- **Remove:** `meditation-form.tsx`, `wizard-steps.tsx`, `script-editor.tsx`,
  `src/lib/meditation/templates.ts` if nothing else imports it, and the edit affordance
  on the meditation page. Update the landing page's links to `/create` if any copy
  describes the wizard.
- **`DESIGN.md`:** replace its create-wizard entries (the width under Layout, the step
  circles under Shape, the `ScriptViewer` contexts) with the studio's: the two-pane
  widths, the canvas column and the phone sheet.

## Interfaces

- Consumes `StudioUIMessage`, `getChat`, `listDraftChats` and `createChat` from 29.
- Produces `renderStudioPart(part: StudioUIMessage['parts'][number]): ReactNode | null`
  in `src/components/studio/parts.tsx`, which 31 and 34 extend. It also produces the
  sheet-open state that 31's cards can call (`useStudio().openCanvas()`).

## Acceptance criteria

- [x] A clear one-line request on a phone-width viewport takes you from `/create` to a
  streaming script with **no form and no question**.
- [x] Canvas following: a 20-minute script streams and the newest line stays in view.
  Scroll up mid-stream and following stops; scroll to the bottom and it resumes.
- [x] Reloading `/create/[chatId]` restores the conversation and the latest script.
- [x] Phone (375 px): the chat is usable one-handed, the sheet opens and closes, and the
  pill appears on every new draft.
- [x] Verification order from the skill: dark, then light, then phone. Screenshots of
  each go in the PR.
- [x] No hand-edit path to the script remains anywhere (`grep -r "script-editor" src`
  returns nothing).

## Outcome

### What changed

- **`/create`** (`create/page.tsx`, `components/studio/new-chat-form.tsx`): one large input
  (Enter sends, Shift+Enter breaks the line) and a "Recent" list from `listDraftChats`, hiding
  chats that were created but never sent to (`title` null). Sending calls `createChat`, leaves
  the request in `sessionStorage` under `studio:first:<chatId>`, and routes to the chat.
- **`/create/[chatId]`** (`create/[chatId]/page.tsx`): `getChat` (404 for a non-UUID, a missing
  chat or someone else's), then `<Studio>` with `useChat({ id, messages })`. The transport's
  `prepareSendMessagesRequest` sends `{ chatId, message }`, only the newest message.
- **`components/studio/`:**
  - `studio.tsx`: the `useChat` owner, the two-pane layout, the phone sheet and the pill.
  - `chat.tsx`: messages, the draft chip, the inline errors and the composer.
  - `script-canvas.tsx`: the canvas.
  - `use-follow-scroll.ts`: the follow-the-stream hook, shared by the chat and the canvas.
  - `drafts.ts`: pure helpers (draft numbering, partial-line trimming, latest details, error
    reading), with tests.
  - `parts.tsx`: `renderStudioPart`.
  - `studio-context.tsx`: `useStudio()`.
  - `audio-card.tsx`: a placeholder for 31.
- **Removed:** `meditation-form.tsx`, `wizard-steps.tsx`, `script-editor.tsx` and
  `lib/meditation/templates.ts`, which only the form imported. The meditation page had no edit
  affordance left to remove; the hand-edit path lived in the form's Edit step.
- **Copy:** the landing page's "Describe it" and "Read the script" steps now describe the chat
  ("say in a sentence…", "change anything by asking") instead of types, lengths and templates.
- **`DESIGN.md`:** the wizard's Layout width, the step circles under Shapes, the raw editor under
  Inputs and Typography, and the Wizard Steps section are replaced by the studio: the `/create`
  column, the two-pane widths, the composer, and a Studio section covering the chat, canvas, phone
  sheet and errors.

### Interfaces for 31, 32 and 34

- `renderStudioPart(part)` in `parts.tsx` handles `tool-offerAudio` through an `AudioCardSlot`.
  The slot reads `useStudio()` and renders
  `<AudioCard part chatId meditationId addToolOutput />`, the props agreed with 31 (meditationId
  `string | null`, `addToolOutput` required). The placeholder `audio-card.tsx` declares exactly
  those props.
- `useStudio()` returns `{ chatId, meditationId, openCanvas, addToolOutput, status }`.
  `meditationId` comes from the newest saved `writeScript` output, falling back to the chat's
  `meditation_id`.
- **`sendAutomaticallyWhen` is already wired:** `answeredAudioCard` resends only when the last step
  holds an answered `tool-offerAudio` and every tool call in it is complete. The stock
  `lastAssistantMessageIsCompleteWithToolCalls` alone would also resend after a turn that stopped
  at the step limit on a server tool. 31 only needs to call `addToolOutput`.

### Decisions

- **Draft numbering** counts `writeScript` calls that saved or are streaming. A refused call
  (`output-error`) gets no number and shows "This draft could not be saved" in the chat.
- **Never presented as saved:** a draft the turn did not save (a stream error, a stop) says
  "Not saved" in Candle, in the canvas header and on its chip. While streaming, the last line is
  held back when it starts with `*`, so a half-written marker never flashes as speech.
- **Following:** the canvas follows while a draft streams. An upward scroll lets go and shows a
  "Follow the writing" button, and returning to the bottom resumes. Each new draft re-pins. A
  script opened on a reload starts at its top, because it is being read, not watched.
- **Reload mid-stream:** without resumable streams, the page shows the last saved state and, when
  the last saved message is an unanswered request, a "may still be on its way" card with Reload.
  The server finishes and saves the turn regardless (task 29's `consumeStream`).
- **Retry** is `regenerate()`. For a 429 this resends the unsaved request. For a stream error the
  route has already saved the request, so the retry stores it a second time, and the model sees
  it twice. That is harmless in practice. Avoiding it would need a route change (dedupe on the
  previous user message), which belongs to the route's owner.
- **First message handoff** is deferred one tick and cancelled on cleanup. In dev Strict Mode,
  `useChat`'s effect cleanup calls `chat.stop()`, which aborted a send made in the first effect
  pass (found in testing: the first request never reached the server).
- **Layout:** the studio fills the viewport under the nav, less the shell padding
  (`h-[calc(100dvh-9rem)]`, `sm:` 11rem), so the composer sits at the bottom and each pane scrolls
  on its own. The chat column is 20rem from `md` and 24rem from `lg`. Inside the 64rem shell the
  canvas gives the script about 502px (~45ch of Lora), under the 65ch cap. That is recorded in
  `DESIGN.md` as the lever to pull if it reads cramped.
- **The pill** is in flow above the composer, not floating. A floating version covered the newest
  chip at 375px. It reads "Writing the script" while streaming and "Script updated" once saved,
  and opening or closing the sheet marks the draft seen.

### Evidence

- `npm run lint`: 0 errors and 5 warnings, all on `main` or in generated `.well-known/workflow`
  files. `npx tsc --noEmit` is clean. `npm test` passes 313 tests in 34 files, 8 of them new
  (`drafts.test.ts`). `npm run build` passes, and `/create` and `/create/[chatId]` are in the
  route list.
- `grep -r "script-editor\|meditation-form\|wizard-steps" src` returns nothing.
- `impeccable detect` over the changed UI files: `[]`.
- **Real model, local Supabase, signed in as alice, `next dev`.** Verified dark desktop, then
  dark 375 px, then light desktop and light 375 px. The 375 px checks used a 375 px same-origin
  iframe, because Chrome windows stop near 500 px and DevTools emulation isn't reachable from
  the extension.
  - **"20 minutes to fall asleep after a long, busy day"** went from `/create` to a streaming
    `writeScript` with **no question first**. The canvas followed the newest line. The script
    landed at about 21 min, then `setDetails` ("Letting the Day Go", 4 tags) and the audio card
    placeholder; the whole turn took about 10 s.
  - **Following:** I scrolled up mid-stream on a revision ("Add a slow body scan…"). The view held
    while the text grew, and "Follow the writing" appeared. The model finished before I could
    scroll back by hand, so I checked the resume in the page by growing the content: pinned gap
    0 px, after scrolling up 900 px (held), back at the bottom 0 px (resumed).
  - **Reload** restored all messages, the chips and Draft 2 with its title, tags and estimate.
  - **Reload 3 s into a turn** showed Draft 3 (the last saved one) and the "may still be on its
    way" card. Reloading about 10 s later showed Draft 4, saved by the server, with no card.
  - **Phone, "5 minute breathing reset before a big presentation":** the pill appeared, the sheet
    opened from it and closed from its X, and a revision raised the pill again ("Writing the
    script") for the new draft. The sheet also opened from a chip.
  - **429:** I stubbed `fetch` with the route's real 429 body. The calm message showed inline with
    "Try again", and after restoring `fetch`, the retry produced Draft 3 from the real model.
  - **Stream error mid-script:** I stubbed a UI stream that breaks inside `writeScript`. The
    partial script showed as "Not saved" on the chip and the canvas, the route's sentence showed
    inline with "Try again", and the cut-off line stopped at "Half a sente".
- Model note, not a UI issue: "Make it 8 minutes" on a 5-minute script took three `writeScript`
  passes (6, then 2, then 8 min) before it landed. Each pass shows as its own chip. Worth
  watching in seeding, alongside task 29's note on `claude-sonnet-5-5`.

### For the operator

- On a phone (installed PWA or Safari): send a one-line request from `/create`, watch the pill,
  open and close the sheet one-handed, and check that the composer stays above the keyboard. The
  viewport-height layout uses `dvh`, which the iframe check cannot exercise against a real
  keyboard.
- `createMeditation` in `src/lib/meditation/actions.ts` has no caller now that the form is gone.
  It is left in place, since removing it is outside this task.
