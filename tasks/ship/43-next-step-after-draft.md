# A Clear Next Step After Every Draft

**Status:** Done (PR #70)
**Priority:** Phase 6. The studio's core loop: draft, then audio.
**Phase:** 6 (seed & open)
**Depends on:** 29 (chat agent), 31 (audio from chat), 34 (previews), 41 (cap rewrites)

## Why

Operator: "the agent sorta generates the script and then nothing happens. We should
probably have the agent prompt the user: any changes? or do you want to generate the
audio?"

## Root cause

Investigated with `superpowers:systematic-debugging`. Evidence came from two places: the 37
script-writing turns persisted in the local `chat_messages`, and 21 turns replayed against
`claude-sonnet-5` through `scripts/measure-studio-rewrites.ts` (prompt on `main`, the route's
settings).

1. **The prompt never asked for a hand-off.** Nothing told the agent to end a script turn by
   asking for the next move, and since task 34 `offerAudio` waits until the person "seems
   happy". So the reply was whatever the model felt like writing:
   - **Revisions ended on a statement in 7 of 9 stored turns** ("Trimmed down to a tidy 6
     minutes." "A short gratitude moment is now woven in near the end."), and in 3 of 3
     replayed ones.
   - **First drafts asked in free-form ways** ("Want to hear it with a voice?"), which the
     person has to answer by typing. In the replay, only 2 of 12 first drafts ended on a
     question. The other 10 called `offerAudio` straight away, against task 34's rule, and
     closed on a statement such as "Your 5-minute breathing break is ready in the canvas."
2. **The step limit can cut the closing line.** `stopWhen: isStepCount(5)` stops after the
   fifth model call whatever it did. Consider a turn that writes, rewrites for length, fixes a
   marker, sets details and then retries a malformed `setDetails` (task 41 saw that retry in
   3 of 6 runs). That turn ends on a tool call with no text. One stored turn used every step
   (`f886386b`: four writes, then `setDetails`) and still got its text in, but nothing
   guaranteed it.
3. **Replying "Make the audio" was unreliable.** In the replay it rewrote and re-timed the
   whole script before showing the card in **4 of 6** runs.
4. **The client hides nothing.** `chat.tsx` renders every non-empty text part. The text that
   did arrive was on screen; it just didn't ask anything.

## Decision

- **Prompt:** every message that writes or revises a script ends, after its last tool call,
  with one short line. The line gives the estimated length rounded to the minute and asks
  whether to change anything or make the audio. It is worded for this meditation, with no
  stock question. The question is the offer, so a script turn no longer calls `offerAudio`
  unless the person asked for audio in that same message.
- **"Make the audio" is enforced in code, not only asked for in the prompt.** In
  `prepareStudioStep` (`src/lib/chat/tools.ts`), when the message is exactly the chip's text
  (`MAKE_AUDIO_REPLY`), the turn's first step gets `activeTools: ["offerAudio"]`. It cannot
  rewrite or re-time the script. A forced `toolChoice` would be stronger, but Anthropic rejects
  a forced tool when thinking is on, so the model can still reply in text. A typed "yes" or
  "let's hear it" still goes through the prompt rule.
- **Step limit:** `prepareStudioStep` makes the turn's last step (step 5 of
  `MAX_STEPS_PER_TURN`) `toolChoice: "none"`, so a turn that spends its budget on tools still
  ends in text. The limit stays at 5. A runaway loop is capped as before.
- **Chips:** `showsQuickReplies(messages, live)` in `src/components/studio/drafts.ts` is the
  pure rule. The latest message must be the agent's finished reply, contain a saved
  `writeScript`, and have no `offerAudio`. `QuickReplies` (`quick-replies.tsx`) renders two
  pills under it. "Make the audio" sends that text; "Change something" focuses the composer
  and sends nothing. Anything sent makes another message the latest, so the chips go.

## Acceptance criteria

- [x] In 10 real first-draft turns, every one ends with a visible next-step line, and the chips
  show.
- [x] "Make the audio" reliably produces the audio card (10 of 10).
- [x] The rule for showing chips is a pure function with a unit test (`drafts.test.ts`, 6 cases).
- [x] "Change something" focuses the composer with no message sent (checked in the browser).
- [x] The chips fit the chat column and phone width with no overflow (dark, then light, then
  390px).
- [x] Task 29's four prompt checks, task 34's no-unprompted-previews check and task 41's
  writes-per-turn measurement do not regress.
- [x] Lint, tsc, tests and build pass.

## Outcome

### What changed

- **`src/lib/ai/prompts.ts`:** the length-acceptance bullet keeps only "keep it". A new bullet
  says how a script turn ends: the length rounded to the minute, then the choice, worded for
  this meditation, with no stock question. The `offerAudio` bullet now says that "Make the
  audio", "yes" and the like mean `offerAudio` first and alone, with no rewrite.
- **`src/lib/chat/tools.ts`:** `MAX_STEPS_PER_TURN` (moved from the route) and
  `prepareStudioStep`, which the route passes as `prepareStep`. Unit tests are in
  `tools.test.ts`.
- **`src/lib/chat/replies.ts`:** `MAKE_AUDIO_REPLY`, shared by the chip and
  `prepareStudioStep`. It lives in its own module so the client never imports `tools.ts`.
- **`src/components/studio/drafts.ts`:** `showsQuickReplies`. **`quick-replies.tsx`:** the
  chips. **`chat.tsx`:** renders them after the messages and holds a ref to the composer.
- **`scripts/measure-studio-rewrites.ts`:**
  - Records each turn's closing line and the finish reason of each step.
  - Adds two scenarios, a first draft followed by "Make the audio" (5 and 6).
  - Uses the route's `prepareStudioStep`.
  - Drops an unanswered `offerAudio` call from history the way the route's
    `ignoreIncompleteToolCalls` does. It used to answer the call as "dismissed", and the app
    never does that.

### Measurements (real model, `claude-sonnet-5`, the route's settings)

**Before** is the prompt on `main`: 3 samples each of scenarios 0, 1, 5 and 6, for 21 turns.
**After** is the final branch: 5 samples each of scenarios 5 and 6, 3 each of 0, 1 and 2, and 1
each of 3 and 4, for 34 turns.

| Check | Before | After |
|---|---|---|
| First drafts that end on the length and a question | 2 of 12 | **10 of 10** |
| First drafts that leave the card for the person (so the chips show) | 2 of 12 | **10 of 10** |
| Script turns whose last step is text (`finishReason: stop`) | 5 of 19 | **22 of 22** |
| Revisions ("Make the middle longer") that end on a question | 0 of 3 | **3 of 3** |
| "Make the audio": `offerAudio` alone, script untouched | 2 of 6 | **10 of 10** |

Turns that ended on `offerAudio` count as "not text" in the before column. The card was on
screen, but the line above it was a statement, such as "Your 5-minute breathing break is ready
in the canvas."

Sample closings: "It runs about 5 minutes, just enough to steady your breath before you walk in.
Want any changes, or shall we make the audio?" and "It settles in at about 21 minutes. Ready for
the audio, perhaps with rain or drone behind it, or would you like anything adjusted first?"

### Re-run checks (same 34 turns)

| Check | Result |
|---|---|
| Task 29: "10 minutes to unwind after a rough day" | `writeScript` first with no question, then `setDetails`, in 3 of 3 runs. |
| Task 29: "Make the middle longer" | The target stayed at 10 in 3 of 3 runs, landing at 9.1–10.4 min. Each reply names the change and the length. |
| Task 29: the Python and essay requests | A one-sentence decline offering a meditation, with no tools (2 of 2). |
| Task 34: no unprompted previews | **0 `previewSounds` calls** in 34 turns. |
| Task 41: writes per turn | **Mean 1.05**, with 1 of 22 script turns writing twice and none more. Task 41's "after" was also 1.05 (1 of 20). Every final draft landed within tolerance: 4.5–5.4 for 5 min, 9.1–10.4 for 10, 20.7–22.4 for 20, 28.9–30 for 30. |

### In the app

These were checked on `localhost` as alice.
- **A new first draft** ("A 5-minute breathing break before a meeting") ended with "It runs
  about 5 minutes — ready to walk into that meeting steadier, or want any tweaks first?" The two
  chips showed under it.
- **"Make the audio"** sent that text. The voice and background card appeared, the chips went,
  and the canvas stayed on Draft 1.
- **"Change something"** focused the composer and sent nothing.
- **The chips stay hidden** on a chat whose latest reply already has the audio card.
- **Verified in order:**
  1. Dark at desktop width.
  2. Dark at 390px in a same-origin iframe, because Chrome stops at about 500px. The page
     `scrollWidth` equals its `clientWidth` (386/386), the chips end at x=370, and both are 32px
     tall.
  3. Light at both widths.

  The chips wrap (`flex-wrap`), so they fit the chat column at any width. `impeccable detect`
  reports nothing on `quick-replies.tsx` and `chat.tsx`.

Screenshots are in `tasks/ship/43-next-step-after-draft/`.

### Decisions

- **The step restriction keys on the exact chip text.** A typed "make the audio please" goes
  through the prompt rule instead, which is the 10-of-10 behaviour above but without the hard
  guarantee. Message metadata would separate a chip tap from typing, but it would add a new
  field to the persisted message shape for no visible difference.
- **No `offerAudio` in a script turn.** It used to be called on most first drafts, against
  task 34's "once the person seems happy". Now the closing question is the offer, and the chips
  or a reply bring up the card. If the person asks for audio in the same message as a change,
  the agent may still call it.
- **The step limit stays at 5.** The last step is now text-only, which still leaves 4 tool steps:
  write, rewrite, details, and a retry.

### For the operator

- **Nothing to configure.** The change ships with the code.
- **On a phone:** tap "Make the audio" under a fresh draft and check that the card appears and
  the chips go. Also tap "Change something" and check that the keyboard opens on the composer.
  iOS may not raise the keyboard on a programmatic focus.
- **Wording variety is better, not perfect.** 20 of 22 closings were distinct, but the second
  half often settles on "want any changes, or shall we make the audio?" (6 of 22), with only the
  first half tied to the meditation. That is worth another prompt pass if it reads as canned
  during seeding.
- **Seen, not fixed:** `setDetails` is still retried in some 30-minute turns (seen in 3 of 3
  runs here, and in task 41). The retry now costs a step out of four, not five.
