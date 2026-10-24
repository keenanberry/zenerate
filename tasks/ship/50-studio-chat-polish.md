# Studio Chat Polish

**Status:** In progress. Code done and verified locally
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 49 (the draft chip shows the cover)

## Why

The 2026-10-23 critique scored the studio highest of the three surfaces (28/40). The script
canvas is the best-crafted surface in the product, but the chat column around it is generic
AI-chat chrome:

- The user's message is a solid `bg-secondary` slab (`chat.tsx`), the brightest object on screen.
- The next step after a draft (task 43) is two 12px pill chips (`quick-replies.tsx`), though
  "Make the audio" is the most important step in the product.
- The Make audio button carries a Sparkles icon (`audio-card.tsx`), the stock AI-magic sign.
- The draft chip is a file icon, not the meditation.
- Nothing tells a first-time user they can ask for a voice, a length or ambient sound.

## Decisions (approved by the operator 2026-10-23)

- The user's message sits on Raised Night with a Hairline border, in Foreground. No slab.
- The draft chip shows the 40px cover, the title in Lora and `Draft 1 · About 5 min`.
- "Make the audio" is a primary button at 36px or taller with a play glyph. "Change
  something" is an outline button beside it.
- No Sparkles icon anywhere in the studio.
- One Dusk hint line under the first reply: you can ask for another voice, a different
  length or ambient sound.
- `/create`'s Recent list shows the title in Lora. Not the cover: a Recent draft is a chat
  with no meditation yet, so every cover would be the same quiet one.
- **Operator, 2026-10-23:** on a phone, tapping Make audio left the button "in a weird
  overlay loading state". It was `disabled` fading the button to half opacity for the few
  seconds the request takes. It now stays at full strength with a spinner, in the studio
  card and on the meditation page's panel.
- The canvas sets its tags as one Dusk line, as the meditation page does (task 54).

## Acceptance

- [x] Studio in dark at 390px (first draft, the audio card, the starting state with the
      render request held by the test) and light at 390px and 1280px. A revision was not run.
- [x] Task 43's behaviour is unchanged: the buttons send the same messages the chips did
      (`MAKE_AUDIO_REPLY`, and focus to the composer).
- [ ] Operator: the buttons on the phone, including whether "Change something" raises the
      keyboard (replaces the 43 phone check).
