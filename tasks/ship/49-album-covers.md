# Album-Style Covers and Discover Tiles

**Status:** Not started
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 48 (quiet list), 35 and 42 (cover system and variety)

## Why

Direction **B** of the plan approved on 2026-10-23 (see task 48 for the critique). The covers
read as clip-art: measured across 45 covers, about 58% of each is empty Deep Night, and the
motif strokes sit at 12–32% opacity. At 48px most look like a dark square with a faint
squiggle. Discover's category tiles use stock Lucide icons rotated 12° on tinted fills
(`category-grid.tsx`), which the critique called the strongest kids'-app signal in the
product.

## Decisions (approved by the operator 2026-10-23)

- **The cover fills with its lead hue** as a flat field (about L 0.40, C 0.055 in dark; the
  ink weight in light), not Deep Night.
- **One bold shape in the second hue** fills 40–70% of the frame and bleeds off an edge. Below
  96px, motifs are filled shapes, not thin strokes.
- **Still derived, never stored**: the same `TAG_HUES` pairs and id hash. Still tokens only.
  Still no gradient: depth comes from at most two or three flat opacity planes.
- **Discover's category tiles join the system**: the category's hue as a field, its motif
  cropped large, the label in Lora. No Lucide icons.
- The mockup at https://claude.ai/artifact/PrasUYaaYSp1M3GfbvUFQt is the reference.

## Acceptance

- [ ] Covers at 48, 64, 176 and 320px in dark and light, on the Library, Discover, a
      meditation page and the studio.
- [ ] Discover's tiles use the cover system; no `rotate-` and no Lucide icon in
      `category-grid.tsx`.
- [ ] Media Session artwork and share images, if they use the cover, still render.
- [ ] `meditation-cover.test.tsx` passes, plus a test that no motif is stroke-only below 96px.
- [ ] `DESIGN.md`'s Covers section is rewritten for the new look.
- [ ] Operator: covers on the phone in both themes (replaces the 35 and 42 phone checks).
