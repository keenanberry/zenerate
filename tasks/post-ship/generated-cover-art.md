# Generated Cover Art

**Status:** Generated covers designed 2026-11-21:
`docs/superpowers/specs/2026-11-21-generated-cover-art-design.md` (unique realistic covers
per meditation, FLUX 2 Klein through AI Gateway, a `makeCover` studio tool, a reviewed
backfill). Custom uploads below are still open and wait on
[image moderation](./image-moderation.md).
**Shipped so far:** PR 1 (#151), storage and display: the `meditation-covers` bucket,
`cover_path`, and `MeditationCover` drawing the photo with the designed cover as fallback.
PR 2, the studio tool: `makeCover` (3 per meditation, a failure not counted) made after
each new meditation's first script, the cover in the canvas header, `/privacy`. PR 3, the
reviewed backfill: `scripts/backfill-covers.ts` generates covers for existing meditations
into a local folder with a contact sheet, and uploads only what the operator kept
(`--commit`); the operator runs it against production (`tasks/OPERATOR-TODO.md`). Covers
are stored as a 1024px WebP, a 512px middle size for cards and a 256px thumbnail, served
as stored, not through Vercel's Image Optimization. PR 3 also changed the style line to
ask for a full-bleed photograph: the old "cover image for a guided meditation app" drew
about one cover in three as an app icon on white. Left: custom uploads (below). The
"Direction" below is the earlier idea; the spec supersedes it for generated art.
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

## Custom uploads (operator idea, 2026-10-23)

With the full-screen session player (ship 55) the cover becomes the most visible thing
in a session, and the operator asked about letting people upload their own picture.
Treat this task as **custom artwork** with three sources: generated, uploaded, and the
designed cover as the default and the fallback. For uploads:

- **Moderation is the cost, not storage.** An uploaded image on a public meditation shows
  to strangers on Discover. Start with uploads shown to the owner only (or on private
  meditations only) until moderation exists; ship 53's Report link is not enough for
  images.
- Resize on upload and strip EXIF, which carries GPS on phone photos.
- `/privacy` lists what is stored; add images in the same PR.
- A photo full-bleed behind the player needs a darker fade than a flat designed cover.

## Decisions to make

- The provider and model, chosen for consistency of style, not novelty.
- Whether art shows on public meditations without the owner's approval.
- Whether art regenerates when a new version changes the script.
