# A Clear Next Step After Every Draft

**Status:** In progress. Code done; the real-model checks are paused until API credits return.
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

- [ ] In 10 real first-draft turns, every one ends with a visible next-step line, and the chips
  show.
- [ ] "Make the audio" reliably produces the audio card (10 of 10).
- [x] The rule for showing chips is a pure function with a unit test (`drafts.test.ts`, 6 cases).
- [x] "Change something" focuses the composer with no message sent (checked in the browser).
- [x] The chips fit the chat column and phone width with no overflow (dark, then light, then
  390px).
- [ ] Task 29's four prompt checks, task 34's no-unprompted-previews check and task 41's
  writes-per-turn measurement do not regress.
- [x] Lint, tsc, tests and build pass.

## Outcome

To be completed after the real-model runs.
