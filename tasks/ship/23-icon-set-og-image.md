# Icon Set + OG Image

**Status:** Done* (*the share-preview checks in iMessage, Slack, X and Discord, and the on-device home-screen check, need a deployed URL and a phone: the operator's, after merge)
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
- [x] A bodhi tree mark, drawn as SVG by hand (not traced from a raster), in the Nocturne
      palette. Where the full tree will not read, a single bodhi leaf: the heart shape with
      the long drip tip is the recognisable part. Decided with the operator 2026-10-09
- [x] Fallback if the mark does not hold at 16px after one honest attempt: a Lora wordmark,
      as originally planned. Do not spend a day on the tree. *Not needed: the full tree failed
      at 16px, the leaf held, so no wordmark (see Outcome)*
- [x] Legible at 16px in a browser tab and at 180px on a phone home screen. Test both before committing.
      *16px checked in Chrome on its light and dark tab colours; 180px checked at 1:1 on dark and
      white grounds with iOS-style corners*
  - [ ] The same on a real phone home screen (operator, after merge)
- [x] Works on the Nocturne dark ground and on white

**Icon set**
- [x] `favicon.ico` replacing the Next.js default
- [x] `icon-192.png`, `icon-512.png`
- [x] `icon-maskable-512.png` with correct safe-zone padding — Android crops to a circle and an unpadded icon loses its edges
- [x] `apple-touch-icon.png` at 180×180, no transparency (iOS composites transparent icons onto black)
- [x] Starter SVGs deleted from `public/`

**OG image**
- [x] `og-image.png` at 1200×630, dark, carrying the mark and the one-line pitch from `PRODUCT.md` ("Meditations composed for you, not picked from a catalogue.")
- [ ] Rendered preview checked in at least two of: iMessage, Slack, Twitter/X, Discord — they crop and letterbox differently (operator, after merge)
- [x] Text large enough to read in a feed thumbnail

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

## Outcome (2026-10-09)

**What shipped**

- `src/assets/brand/mark.svg`: the source. A bodhi leaf held tip-up, heart-shaped with the
  long drip tip, its veins drawn as a small tree: the midrib is the trunk, three pairs of
  side veins are the branches. Hand-drawn on a 100-unit grid, no raster traced.
- `src/components/brand-mark.tsx`: `BrandMark`, the same geometry inline in `currentColor`.
  The veins are cut out with a per-instance mask (`useId`), so the ground shows through on
  Midnight, Paper or white. `veins={false}` for nav and favicon sizes; `title` gives it an
  accessible name, and without one it is `aria-hidden`. Not placed anywhere yet: the nav and
  landing header belong to a follow-up after task 22.
- `scripts/build-icons.ts` renders every export from the source with `@resvg/resvg-js`:
  `src/app/favicon.ico` (16/32/48), `public/icon-192.png`, `public/icon-512.png`,
  `public/icon-maskable-512.png`, `public/apple-touch-icon.png` (180×180, opaque) and
  `public/og-image.png` (1200×630). `--check` re-renders in memory and fails if a committed
  file differs.
- The five Next.js starter SVGs are gone from `public/`.

**Decisions**

- *The tree, honestly attempted, did not hold.* A full bodhi tree (spreading canopy, trunk,
  flared roots) read as a mushroom at 16px. The rose trunk vanished against the amethyst
  canopy, and at 180px it was a generic cartoon tree with nothing bodhi about it. The leaf
  held at both sizes, so the leaf is the mark and the tree lives inside it as the veins.
  The Lora wordmark fallback was not needed.
- *Tip-up, with a curving tip.* Symmetric and upright, the plain silhouette reads as a
  spade (tip up) or a valentine heart (tip down). A long drip tip that leans slightly,
  a shallow notch and a thin curved stem make it a leaf. Tilting it read as a leaf too,
  but lost the leaf-as-tree reading.
- *Two colours, no gradient.* Amethyst Glow leaf, Rose Quartz veins, on Midnight. The
  purple-to-rose gradient stays the player's (The One Gradient Rule).
- *Veins only from 64px.* At 16, 32 and 48px the veins blur into the leaf, so the favicon
  is the plain silhouette, on a transparent ground at full size. In Chrome's light and
  dark tab strips the leaf, tip and stem read. The weakest pairing is an inactive light
  tab (`#dee1e6`), where Amethyst Glow is legible but low in contrast. A Midnight tile
  behind it was tried and rejected: it shrinks the leaf to 12px.
- *`icon-192`/`icon-512` are full-bleed Midnight, not transparent.* Task 25 uses them as
  lock-screen artwork, and an opaque square holds on any ground an install surface or
  media UI puts it on. The maskable icon is the same with the mark at 0.68 scale. Its
  artwork reaches 0.329 of the width from the centre, inside the 0.4 safe circle; the
  build measures this from the pixels and fails above 0.4.
- *Colours from DESIGN.md.* The build reads the frontmatter tokens (`midnight`,
  `amethyst-glow`, `rose-quartz`, `moonlit`) and converts OKLCH to sRGB hex, because
  resvg does not parse `oklch()`.
- *Lora as a committed TTF.* `src/assets/brand/fonts/Lora-Medium.ttf` (static instance,
  OFL, licence alongside), with system fonts off. The OG text then renders the same on
  any machine and needs no network. The OG layout measures the rendered pitch and
  centres mark and text as one group, so a font change cannot push the text off the
  card.
- *favicon.ico only in `src/app/`.* A second copy in `public/` would collide with the App
  Router's file convention at `/favicon.ico`. Nothing is wired into metadata (task 26) or
  a manifest (task 24).

**Evidence**

- `npx tsx scripts/build-icons.ts --check` prints every file with its dimensions and reports
  all six byte-identical to a fresh render. Two consecutive builds produce the same SHA-256.
- The build asserts the apple-touch-icon and OG image are fully opaque and the maskable
  artwork is inside the safe zone.
- Unit tests for every pure function: OKLCH conversion against the CSS Color 4 primaries,
  frontmatter parsing, ICO encoding, PNG header reading, opacity, safe-zone reach, ink
  measurement, the SVG composition, and `BrandMark` against the source SVG's geometry.
- Browser (Chrome, local dev on :3123, temporary preview route since removed), in order:
  - dark at desktop width;
  - dark at 390px, in a 390px iframe, with no horizontal scroll;
  - light at both widths;
  - the favicon at 16 CSS px on Chrome's light and dark tab colours;
  - the 180px icons at 1:1 on white and black;
  - the maskable icon under a circle and a squircle crop;
  - the OG image at 300px wide, where the 66px pitch lands at about 16px.

**Found along the way**

- `npm install` with npm 11.16 rewrites the whole `package-lock.json` (about 23k lines) by
  re-resolving peer dependencies. This PR splices in only the `@resvg/*` entries
  (`npm ci --dry-run` accepts it). The next dependency change will meet the same rewrite.
- `vitest.config.ts` only collected tests under `src/`; it now also picks up
  `scripts/**/*.test.ts`.
- `BrandMark` gets unique mask ids from `useId` (`_S_4_` style in React 19.2), and the masks
  resolve in Chrome with several instances on one page.

**Follow-up (2026-10-09): the mark placed in the UI**

- `src/components/nav.tsx`: `BrandMark` beside the lowercase `zenerate` wordmark, 22px,
  `text-primary`, `veins={false}`. One component, so it reaches the landing page, the app
  shell and the legal layout; task 22 left no separate header markup in `src/app/page.tsx`.
- `src/app/(auth)/login/page.tsx`: the mark at 64px with its veins, stacked above the
  wordmark and the card title. The link's hit area shrinks to the mark and wordmark
  (`justify-self-center`) instead of the card's full width.
- *Alignment.* Measured in Chrome: Geist bold at 18px has a 12.8px cap height, so a 20–24px
  mark cannot sit inside it. The leaf's base sits on the baseline (38.7px against a 38px
  baseline, the overshoot a round letter has) and the stem hangs like a descender, which
  takes `-translate-y-px` on top of `items-center`. 22px, not 20: at 20 the leaf read light
  beside the bold wordmark.
- *Colour.* `text-primary` (Amethyst Glow in dark, Amethyst in light), matching the icon
  set; no gradient. As a graphic it clears 3:1 on every ground: 6.5:1 on Midnight, 5.9:1
  on the dark card, 3.6:1 on Paper, 3.9:1 on the white card.
- *Accessibility.* The mark is `aria-hidden` (no `title`); the wordmark text stays the
  link's name.
- *Checked*, on a dev server on :3127, in order: dark at 1440px; dark at 390px (landing and
  login, `scrollWidth` 390, no overflow with the signed-in nav, the widest variant); light at
  390, 600 and 1440px; every `Nav` usage site (`/`, `/dashboard`, `/discover`, `/terms`) in
  both themes at 1440px; the impeccable detector once on both files, no findings.
- *Found.* A hot edit left the dev server server-rendering the old class, which showed as a
  hydration mismatch on the mark's `<svg>`; a clean restart cleared it, and every check above
  ran after it. `DESIGN.md` (Navigation: "Wordmark `zenerate` in bold…") and `PRODUCT.md`
  (Brand Commitments: "Logo: none exists") predate the mark and now lag the UI; neither file
  was in this follow-up's scope.

## Superseded (2026-10-09)

The operator did not love the leaf once it was live: it read as a generic tree leaf. The
mark is now a line-art lotus (the operator's reference was a tattoo-style five-petal
lotus), drawn to the same pipeline: `mark.svg` is still the source, `build-icons.ts`
still renders every raster, and the component test still holds the two in step. What
changed is the shape and the small-size strategy: instead of dropping detail (veins) below
64px, the mark has two stroke weights, and below 32px the petals alone carry it. The
decisions above about grounds, scales, the maskable safe zone and the OG layout stand.
