# Studio Chat Polish

**Status:** Not started
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
- `/create`'s Recent list shows the cover, the title in Lora and a Dusk date line.

## Acceptance

- [ ] Studio in dark and light, desktop and 390px, through a first draft, a revision and the
      audio card.
- [ ] Task 43's behaviour is unchanged: the buttons send the same messages the chips did.
- [ ] Operator: the buttons on the phone, including whether "Change something" raises the
      keyboard (replaces the 43 phone check).
