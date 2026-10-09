# Icon Set + OG Image

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 21 (Nocturne palette)
**Blocks:** 24 (PWA manifest needs the icons), 26 (SEO metadata needs the OG image)

## Why this blocks ship

`public/` contains exactly five files: `file.svg`, `globe.svg`, `next.svg`,
`vercel.svg`, `window.svg` — the untouched Next.js starter set. `src/app/favicon.ico` is
still the Next.js default.

There is no app icon, no maskable icon, no apple-touch-icon, and no OG image. The PWA
(task 24) cannot be installed without icons, and every link shared anywhere renders as a
bare URL.

## Acceptance criteria

**Mark**
- [ ] A bodhi tree mark, drawn as SVG by hand (not traced from a raster), in the Nocturne
      palette. Where the full tree will not read, a single bodhi leaf: the heart shape with
      the long drip tip is the recognisable part. Decided with the operator 2026-10-09
- [ ] Fallback if the mark does not hold at 16px after one honest attempt: a Lora wordmark,
      as originally planned. Do not spend a day on the tree
- [ ] Legible at 16px in a browser tab and at 180px on a phone home screen. Test both before committing
- [ ] Works on the Nocturne dark ground and on white

**Icon set**
- [ ] `favicon.ico` replacing the Next.js default
- [ ] `icon-192.png`, `icon-512.png`
- [ ] `icon-maskable-512.png` with correct safe-zone padding — Android crops to a circle and an unpadded icon loses its edges
- [ ] `apple-touch-icon.png` at 180×180, no transparency (iOS composites transparent icons onto black)
- [ ] Starter SVGs deleted from `public/`

**OG image**
- [ ] `og-image.png` at 1200×630, dark, carrying the mark and the one-line pitch from `PRODUCT.md` ("Meditations composed for you, not picked from a catalogue.")
- [ ] Rendered preview checked in at least two of: iMessage, Slack, Twitter/X, Discord — they crop and letterbox differently
- [ ] Text large enough to read in a feed thumbnail

## Implementation notes

- A static PNG is the right call over Next's `ImageResponse` for v1. Dynamic per-meditation OG images are a nice post-ship feature, not a launch requirement, and a static file has no runtime cost or failure mode.
- Maskable icons need roughly 20% padding on all sides. `maskable.app` previews the crop.
- iOS ignores `theme_color` for the home-screen icon background and composites transparency onto black — ship the apple-touch-icon with an opaque background matching the Nocturne dark ground.
- Keep the source file (SVG or design file) in the repo, not just the exports. Re-cutting sizes from a flattened PNG later is miserable.

## Open questions

- *(Resolved 2026-10-09: a bodhi tree or bodhi leaf mark, SVG-authored, wordmark as fallback.
  The operator may generate raster references with an image model to steer the drawing;
  the shipped source is still the hand-drawn SVG, because a traced raster is lossy at 16px.)*
  ~~Does the mark need to encode "zen" or "audio" at all, or is a clean wordmark enough?~~
