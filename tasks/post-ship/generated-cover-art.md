# Generated Cover Art

**Status:** Not started
**Priority:** Post-ship
**Related:** `tasks/ship/35-cover-system.md` (the designed covers this replaces where art exists),
`docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why it matters

The operator wants `/discover` to feel like a Spotify list, with art that gives each
meditation character. Ship task 35 delivers deterministic designed covers that are free
and always on brand. Generated art is the upgrade: unique to each meditation and drawn
from its script.

## Direction

- Generated once, when the first audio completes, never per view. Stored in Supabase
  Storage next to the audio, with the path on the meditation row. An image costs a few
  cents, so even hundreds of meditations stay cheap. Cost is not the risk.
- **The real risk is the look.** Generated images drift away from Nocturne. Pin a style
  prompt that is tested against `DESIGN.md`'s grounds in both themes, and render the
  designed cover as the fallback whenever there's no image or one fails a check.
- Opt-in per meditation at first: a "Make artwork" card in the chat, so the owner sees
  it before it's public.
- Media Session artwork and per-meditation OG images (an idea from the Phase 3 closeout)
  both get it for free.

## Decisions to make

- The provider and model, chosen for consistency of style, not novelty.
- Whether art shows on public meditations without the owner's approval.
- Whether art regenerates when a new version changes the script.
