# Studio UI: Chat + Script Canvas

**Status:** Not started
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

- [ ] A clear one-line request on a phone-width viewport takes you from `/create` to a
  streaming script with **no form and no question**.
- [ ] Canvas following: a 20-minute script streams and the newest line stays in view.
  Scroll up mid-stream and following stops; scroll to the bottom and it resumes.
- [ ] Reloading `/create/[chatId]` restores the conversation and the latest script.
- [ ] Phone (375 px): the chat is usable one-handed, the sheet opens and closes, and the
  pill appears on every new draft.
- [ ] Verification order from the skill: dark, then light, then phone. Screenshots of
  each go in the PR.
- [ ] No hand-edit path to the script remains anywhere (`grep -r "script-editor" src`
  returns nothing).
