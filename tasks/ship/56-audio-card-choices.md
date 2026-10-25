# Audio Card: Summary First, Remembered Choices

**Status:** Done* (PR #96). The iPhone check is an operator item
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 50 (studio chat polish), 55 (merged in #93; it left the audio card and the Generate Audio panel alone).

## Why

A tester on the operator's iPhone (2026-10-23) "only saw two [voices] and didn't know she
could listen to them". Two causes, both in the code:

- When the card appears, the chat's follow-scroll (`scrollToEnd` in `chat.tsx`) brings the
  **bottom** of the newest message into view. For the tall audio card that is the ambience
  grid and the Make audio button; the voices sit above, off screen.
- On a phone the voice picker is one column of ~130px cards, so two fit, and previewing
  is a small unlabelled play icon in each card's corner.

The operator wants this before launch, and folds in the first slice of
`tasks/post-ship/agent-user-memory.md` (preselect last-used), which was already decided
on 2026-10-22: preselect, not suggest.

Mockup: https://claude.ai/artifact/FC4927G3Vz6HHrEY23JDaM

## Decisions (proposed; confirm against the mockup)

- **Summary first.** The card shows the chosen voice (name, description, a labelled
  **Listen** button, **Change**) and the chosen background (name, Change), then the length
  and renders left, then Not now and Make audio. It fits on one phone screen.
- **Change opens a compact list in place.** One row per voice: a check for the chosen one,
  the name with the gender beside it ("Serena · Female"), the description underneath, and
  its own Listen button that becomes Stop while playing. The description **wraps to a
  second line rather than truncating** (operator, 2026-10-24: the ElevenLabs descriptions
  are short but should be read in full), capped at two lines as a guard; the mockup's
  one-line truncation is superseded. Tapping a row chooses it; Done folds the list. Backgrounds use the
  same rows, with None first ("Silence under the voice").
- **Preselect last time.** The voice and bed come from the person's most recent completed
  meditation's `settings` (owner-only, RLS-bound, no new table), marked "Same as last
  time". The agent's per-render suggestion still wins for the bed and shows as "Suggested
  for this one", as today. With no history: Brittney and None, as today.
- **Scroll to the card's top** when it appears, not its bottom.
- **No agent changes.** Preselecting gives the "same as before?" moment without touching
  the prompt; the agent-context slice in `agent-user-memory.md` stays post-ship and may not
  be needed.
- The meditation page's Generate Audio panel takes the same compact picker, so the two
  never drift apart. Task 55 (#93) reshaped that page but left `generate-audio-panel.tsx`
  alone, so this is a straight swap of its picker.

## Acceptance

- [x] At 390px the whole card is on screen when it appears, with the voice row visible.
- [x] A returning user's card preselects their last voice and bed, marked; a new user gets
      Brittney and None.
- [x] Every voice and bed can be previewed from a labelled control; one preview plays at a
      time.
- [x] The started render uses the voice and bed shown (`offerAudio` output unchanged).
- [x] Dark and light, 390px and desktop; `impeccable detect` clean.
- [ ] Operator: the card on the iPhone, including that previews play.

## As built

- `src/components/audio-choices.tsx` holds `VoiceChoice` and `AmbienceChoice`, used by the
  studio card and the meditation page's Generate Audio panel. They replace `voice-picker.tsx`
  and `studio/ambience-picker.tsx`. Previews share the studio's one-at-a-time player.
- Listen is the system's outline button (6px radius), not the mockup's pill, per DESIGN.md
  Buttons.
- The panel gained the Background row too, so both surfaces choose the same two things; it
  used to send only a voice.
- Last-used comes from `getAudioOffer().lastUsed` (card) and `getLastAudioChoices()` (panel):
  the newest completed meditation by `updated_at`. A voice since dropped from the collection
  is not preselected. Precedence lives in `src/lib/audio/choices.ts`.
- The chat anchors on `data-follow-anchor` (`use-follow-scroll.ts`): its top is kept in view
  while the card loads, until the person touches or scrolls; it does not re-pin to the bottom
  until they send a message.
