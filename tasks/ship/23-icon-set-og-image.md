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
- [ ] A simple mark designed — a wordmark or monogram is fine; this does not need to be a logotype project
- [ ] Legible at 16px in a browser tab and at 180px on a phone home screen. Test both before committing
- [ ] Works on the Nocturne dark ground and on white

**Icon set**
- [ ] `favicon.ico` replacing the Next.js default
- [ ] `icon-192.png`, `icon-512.png`
- [ ] `icon-maskable-512.png` with correct safe-zone padding — Android crops to a circle and an unpadded icon loses its edges
- [ ] `apple-touch-icon.png` at 180×180, no transparency (iOS composites transparent icons onto black)
- [ ] Starter SVGs deleted from `public/`

**OG image**
- [ ] `og-image.png` at 1200×630, dark, carrying the mark and the one-line pitch from task 22
- [ ] Rendered preview checked in at least two of: iMessage, Slack, Twitter/X, Discord — they crop and letterbox differently
- [ ] Text large enough to read in a feed thumbnail

## Implementation notes

- A static PNG is the right call over Next's `ImageResponse` for v1. Dynamic per-meditation OG images are a nice post-ship feature, not a launch requirement, and a static file has no runtime cost or failure mode.
- Maskable icons need roughly 20% padding on all sides. `maskable.app` previews the crop.
- iOS ignores `theme_color` for the home-screen icon background and composites transparency onto black — ship the apple-touch-icon with an opaque background matching the Nocturne dark ground.
- Keep the source file (SVG or design file) in the repo, not just the exports. Re-cutting sizes from a flattened PNG later is miserable.

## Open questions

- Does the mark need to encode "zen" or "audio" at all, or is a clean wordmark enough? A wordmark is faster, safer, and easier to make legible at 16px. Default: wordmark, unless something better falls out quickly.
