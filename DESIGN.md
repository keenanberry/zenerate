---
name: Zenerate
description: A nocturne reading room. Dark-first amethyst, serif script, one rose gradient on the player.
colors:
  # Dark theme, the design target. Values are the shipped .dark block in src/app/globals.css.
  deep-night: "oklch(0.1985 0.0200 293.6639)"
  midnight: "oklch(0.2166 0.0215 292.8474)"
  raised-night: "oklch(0.2544 0.0301 292.7315)"
  hush: "oklch(0.2560 0.0320 294.8380)"
  well: "oklch(0.2847 0.0346 291.2726)"
  hairline: "oklch(0.3063 0.0359 293.3367)"
  plum-hover: "oklch(0.3181 0.0321 308.6149)"
  violet-shadow: "oklch(0.4604 0.0472 295.5578)"
  dusk: "oklch(0.6974 0.0282 300.0614)"
  amethyst-glow: "oklch(0.7058 0.0777 302.0489)"
  rose-quartz: "oklch(0.8391 0.0692 2.6681)"
  moonlit: "oklch(0.9053 0.0245 293.5570)"
  ember: "oklch(0.6875 0.1420 21.4566)"
  sage: "oklch(0.7321 0.0749 169.8670)"
  candle: "oklch(0.8540 0.0882 76.8292)"
  periwinkle: "oklch(0.7857 0.0645 258.0839)"
  # Light theme, the :root block. Checked, not designed in.
  paper: "oklch(0.9777 0.0041 301.4256)"
  paper-raised: "oklch(1 0 0)"
  paper-muted: "oklch(0.8906 0.0139 299.7754)"
  paper-hairline: "oklch(0.8447 0.0226 300.1421)"
  lilac: "oklch(0.8957 0.0265 300.2416)"
  ink: "oklch(0.3651 0.0325 287.0807)"
  ink-soft: "oklch(0.5288 0.0375 290.7895)"
  amethyst: "oklch(0.6104 0.0767 299.7335)"
  rose: "oklch(0.7889 0.0802 359.9375)"
  rose-ink: "oklch(0.3394 0.0441 1.7583)"
  ember-light: "oklch(0.6332 0.1578 22.6734)"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
  script:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.9
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  ui:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Geist Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "80px"
components:
  button-primary:
    backgroundColor: "{colors.amethyst-glow}"
    textColor: "{colors.midnight}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "oklch(0.7058 0.0777 302.0489 / 0.9)"
  button-outline:
    backgroundColor: "oklch(0.2847 0.0346 291.2726 / 0.3)"
    textColor: "{colors.moonlit}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.moonlit}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "oklch(0.3181 0.0321 308.6149 / 0.5)"
    textColor: "{colors.rose-quartz}"
  card:
    backgroundColor: "{colors.raised-night}"
    textColor: "{colors.moonlit}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "oklch(0.2847 0.0346 291.2726 / 0.3)"
    textColor: "{colors.moonlit}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge:
    backgroundColor: "{colors.violet-shadow}"
    textColor: "{colors.moonlit}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  nav:
    backgroundColor: "{colors.midnight}"
    textColor: "{colors.moonlit}"
    height: "56px"
  play-button:
    backgroundColor: "linear-gradient(135deg, oklch(0.7058 0.0777 302.0489), oklch(0.8391 0.0692 2.6681))"
    textColor: "{colors.midnight}"
    rounded: "{rounded.full}"
    size: "48px"
---

<!-- Colours, radius and spacing are extracted from src/app/globals.css as shipped. The
typography scale and the named rules record the Nocturne direction approved 2026-09-11
(docs/superpowers/specs/2026-09-11-go-live-design.md). Where the code lags a rule, the
rule names the task that closes the gap. -->

# Design System: Zenerate

## Overview

**Creative North Star: "The Nocturne Reading Room"**

A quiet room after dark. The ground is a deep amethyst night, the text is a pale lavender
that reads like moonlight on paper, and the one source of light in the room is the
player: a soft purple-to-rose glow where the sound comes from. Everything else recedes.
Meditation scripts are set in a serif at a reading measure, because the script is read
before it is heard and again after; the interface around it is a quiet sans that stays out
of the way.

Dark is the design target, not a mode. It matches when people actually meditate and it is
where the amethyst-haze palette has character; the light theme is the same room with the
curtains open, checked for correctness on every surface but never the place a decision is
made. Density is loose and unhurried: wide margins, generous card padding, slow
transitions, nothing that reads as a dashboard.

The incumbent implementation is stock shadcn at dev-tool density, and it is the
anti-reference for rhythm: `h-14` navigation, `py-8` sections, `gap-2` rows and
`max-w-5xl` on every column regardless of content. The tokens are right; the way they are
used is what the Nocturne pass (task 21) changes.

**Key Characteristics:**
- Dark-first, light-correct
- Serif for reading and headings, sans for chrome
- Elevation by lightness, never by shadow
- One gradient, on the player, and nowhere else
- Soft and unhurried: generous padding, gentle radius, slow motion

## Colors

A single violet hue family at low chroma, with one rose note reserved for the signature.

### Primary
- **Amethyst Glow** (`oklch(0.7058 0.0777 302.0489)`): the primary action colour in dark;
  buttons, focus rings, the waveform cursor, active states. Light counterpart is
  **Amethyst** (`oklch(0.6104 0.0767 299.7335)`).

### Secondary
- **Rose Quartz** (`oklch(0.8391 0.0692 2.6681)`): the rose. In dark it ships as
  `--accent-foreground` (and `--chart-2`) and is used nowhere yet. It is the far end of the
  player gradient and a hover text colour on ghost buttons. Its light counterpart,
  **Rose** (`oklch(0.7889 0.0802 359.9375)`), ships as `--accent`. The two themes put the
  rose in different tokens; task 21 gives the gradient its own token rather than reaching
  through `--accent`.
- **Violet Shadow** (`oklch(0.4604 0.0472 295.5578)`): secondary fills, badges, the
  selected nav item.

### Tertiary
- **Sage** (`oklch(0.7321 0.0749 169.8670)`), **Candle** (`oklch(0.8540 0.0882 76.8292)`),
  **Periwinkle** (`oklch(0.7857 0.0645 258.0839)`): the three non-violet hues the theme
  defines (`--chart-3..5`). When a state needs a colour the violets cannot carry (a
  warning, a success, a marker type), it is derived from one of these as a named token,
  not from the Tailwind palette.
- **Ember** (`oklch(0.6875 0.1420 21.4566)`): destructive and failed states only.

### Neutral
- **Deep Night** (`oklch(0.1985 0.0200 293.6639)`): the lowest surface; sidebar token,
  available for a future footer or rail.
- **Midnight** (`oklch(0.2166 0.0215 292.8474)`): the page ground in dark.
- **Raised Night** (`oklch(0.2544 0.0301 292.7315)`): cards and popovers. One step above
  the ground; that step is the elevation.
- **Hush** (`oklch(0.2560 0.0320 294.8380)`): muted fills, skeletons, the waveform
  placeholder.
- **Plum Hover** (`oklch(0.3181 0.0321 308.6149)`): hover surface for ghost and outline
  buttons.
- **Hairline** (`oklch(0.3063 0.0359 293.3367)`): every border; the unplayed waveform.
- **Moonlit** (`oklch(0.9053 0.0245 293.5570)`): text.
- **Dusk** (`oklch(0.6974 0.0282 300.0614)`): secondary text, timestamps, labels.
- Light: **Paper** ground (`oklch(0.9777 0.0041 301.4256)`, chroma 0.004, near grey and the
  weak point task 21 warms), **Paper Raised** white cards, **Ink** text
  (`oklch(0.3651 0.0325 287.0807)`), **Ink Soft** secondary text, **Lilac** secondary
  fills, **Paper Hairline** borders.

### Named Rules
**The Token Rule.** Every colour in a component comes from a theme token: `bg-primary/10`,
`text-muted-foreground`, `border-border`, `bg-destructive/10`. A Tailwind palette class
(`amber-500`, `blue-700`, `emerald-600`) is a missing token; add the token to both `:root`
and `.dark` in `globals.css` and use it.

**The One Gradient Rule.** Amethyst Glow to Rose Quartz appears on the play button and the
played portion of the waveform. It appears nowhere else: not on CTAs, not on card headers,
not on the hero. In light mode it renders as a flat tint, not a glow.

**The Dark First Rule.** A surface is designed and reviewed in dark, then checked in
light. Never the reverse. A light-mode fix that would change the dark design is the wrong
fix.

## Typography

**Display Font:** Lora (with Georgia, serif)
**Body Font:** Geist (with system sans-serif)
**Label/Mono Font:** Geist Mono

**Character:** A literary serif for what is read slowly and a neutral sans for what is
operated. The contrast between them is the point: a global serif would make the forms feel
antique; a global sans makes the script feel like a settings page.

### Hierarchy
- **Display** (500, `clamp(2rem, 5vw, 3rem)`, 1.15): the landing hero and page titles.
  Lora.
- **Headline** (500, 1.5rem, 1.25): section headings, meditation titles on their own page,
  card titles that carry the page. Lora.
- **Script** (400, 1.125rem, 1.9): spoken passages in the script viewer. Lora, at a
  measure of 65ch. The line-height and the measure matter more than the face.
- **Body** (400, 1rem, 1.5): descriptions, legal text, form help. Geist.
- **UI** (500, 0.875rem, 1.25): buttons, nav items, tabs, menu items. Geist.
- **Label** (500, 0.75rem, 0.06em tracking): badges, field labels, and the structural
  markers in the script viewer. Geist. Whether markers are small-caps sans or italic serif
  is an open question task 21 settles; until then, Label.
- **Mono** (400, 0.875rem, 1.625): the raw script editor and error digests. Geist Mono.

### Named Rules
**The Loaded Face Rule.** A font token names a face only if `src/app/layout.tsx` loads it
with `next/font` and the token references that face's CSS variable. The variable carries
the metric-matched fallback `next/font` generates, and it does not depend on the family
name the bundler registers (Turbopack keeps the plain name, webpack hashes it); a token
that names a face nobody loads, as `"Lora"` and `"Fira Code"` once did, falls back to the
system without a word. All three tokens are now wired: `--font-sans` to Geist,
`--font-serif` to Lora and `--font-mono` to Geist Mono, through their variables in every
block that declares them (task 20).

**The Measure Rule.** Prose gets a measure: 65ch for the script, about 60ch for legal and
descriptive text. A prose column never inherits the shell's `max-w-5xl`.

## Layout

The shell (`src/app/(app)/layout.tsx`) centres content at `max-w-5xl` (64rem) with a
16px gutter and `py-8`. That width is right for card grids and wrong for everything else,
so width is chosen per content type inside the shell:

- Grids of meditations or collections: the full 64rem.
- The create wizard and other forms: 28rem to 32rem (`max-w-md` / `max-w-lg`).
- The script viewer and any prose: 65ch.
- Legal pages: 48rem (`max-w-3xl`), the width the `(legal)` layout already uses.
- Login: a single 28rem card centred in the viewport.

The navigation is a single 56px bar with the lowercase wordmark on the left, section links
beside it (icons only below `sm`), and theme toggle plus sign-in/out on the right. The
landing page and the legal layout each duplicate this header; task 22 reconciles them.

Vertical rhythm today is `py-8` between the shell and content, `space-y-3` between script
passages, `gap-2` in rows, and `py-20` between landing sections. The Nocturne pass loosens
all of it: more air around cards and sections, `space-y-5` or more between passages. The
exact steps are settled in task 21 and recorded here afterwards; the direction is
decided.

Breakpoints are Tailwind defaults (`sm` 640px, `md` 768px, `lg` 1024px). The phone target
is 390px wide, because the next step for this product is an installed PWA. Everything must
work there without horizontal scroll.

## Elevation & Depth

Tonal layering, no shadows. Depth in dark is the step from Deep Night to Midnight to
Raised Night to Plum Hover: lower surfaces are darker, raised surfaces are lighter, and a
1px Hairline border marks the edge. Shadows are invisible on a dark ground and read as
smudge, so they carry no information here.

The theme still defines a shadow vocabulary (`--shadow-2xs` to `--shadow-2xl`, 6% black)
and two stock shadcn primitives use it: `shadow-sm` on `Card` and `shadow-xs` on `Input`
and the outline `Button`. Those are inherited, not chosen, and task 21 removes them. New
code adds none.

The one place depth is lit rather than stepped is the player: a soft radial glow in
Amethyst Glow behind it in dark. In light, the same shape is a flat tint.

Focus is a 3px ring in `--ring` at 50% plus a `--ring` border, on every interactive
element. It is the only outline the system uses.

### Named Rules
**The Lightness Rule.** Elevation is a lighter surface token, never a `shadow-*` class.

**The Flat Tint Rule.** Anything that glows in dark is a flat tint in light. Light mode
gets the shape of the signature, not its luminosity.

## Shapes

Gently rounded, never pill-shaped except where the element is a circle. The base radius
is 0.5rem: cards and dialogs at 12px (`rounded-xl`), buttons, inputs and script markers
at 6px (`rounded-md`), badges, avatars, the play button and the wizard step circles fully
round. Borders are 1px Hairline everywhere; there are no 2px borders and no dashed borders
in the system today.

The waveform is 3px bars with a 2px gap and 3px bar radius, 80px tall. It is the one
texture in the interface and it stays unadorned.

## Components

### Buttons
- **Shape:** gently rounded (6px); 36px tall by default, 32px small, 40px large, square
  36px for icon buttons.
- **Primary:** Amethyst Glow fill, Midnight text, 16px horizontal padding; hover drops the
  fill to 90%.
- **Outline:** transparent with a Hairline border (in dark, a 30% Well fill); hover moves
  to Plum Hover.
- **Ghost:** no fill; hover is 50% Plum Hover with Rose Quartz text. Used for nav items,
  the player's transport controls, and sign-in/out.
- **Secondary:** Violet Shadow fill, used for the active nav item and as the badge base.
- **Destructive:** Ember. **Link:** Amethyst Glow text with an underline on hover.
- **Focus:** the 3px ring. **Disabled:** 50% opacity, no pointer events.

### Badges
- **Style:** fully round, 8px horizontal padding, Label type, Violet Shadow fill with
  Moonlit text (`secondary`).
- **State:** meditation status badges on cards (Generating, Script Ready, Processing
  Audio, Completed, Failed) today override the fill with raw palette classes; under the
  Token Rule they move to tokens derived from Candle, Sage, Periwinkle and Ember.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Raised Night in dark, white in light; Moonlit / Ink text.
- **Shadow Strategy:** none (see Elevation). The inherited `shadow-sm` goes in task 21.
- **Border:** 1px Hairline.
- **Internal Padding:** 24px today, which the Nocturne pass increases. A meditation card
  is a whole-card link with the play and favourite controls layered above it; hover is a
  50% Hush fill.

### Inputs / Fields
- **Style:** 36px tall, 6px radius, 1px Hairline border, transparent in light and 30% Well
  in dark, 12px horizontal padding, Body type (0.875rem from `md` up).
- **Focus:** border to `--ring` and the 3px ring.
- **Error:** border and ring to Ember at 20% (40% in dark). **Disabled:** 50% opacity.
- The raw script editor is a `textarea` in Mono at 400px minimum height.

### Navigation
- A 56px bar, `border-b`, 95% Midnight with backdrop blur. Wordmark `zenerate` in bold
  tracking-tight at 1.125rem. Items are ghost buttons with a 16px icon and a label hidden
  below `sm`; the active item is `secondary`. The theme toggle is an icon button whose sun
  and moon cross-fade with a rotate.

### Script Viewer (signature)
The reading surface. Spoken passages are Script type at a 65ch measure. Between them sit
structural markers for pause, silence and sound: each is a single row with a 14px icon,
a Label-type name, and the duration or file name, visually distinct from prose so the eye
skips them when reading and finds them when scanning. Today they are filled boxes in raw
amber, blue and purple; under the Token Rule they become token-coloured annotations, and
task 21 decides small-caps sans versus italic serif. During playback, the passage being
spoken brightens to Moonlit and passed passages dim to Dusk (task 21).

### Audio Player (signature)
A card holding the waveform, a round 40px play/pause ghost button, a tabular-figure time
readout in Dusk, and download, mute and volume controls on the right. The Nocturne pass
makes the play button and the played waveform the gradient moment, with a soft Amethyst
Glow radial behind the card in dark and a flat tint in light. Colours are resolved from
CSS variables at mount (`resolveCssColor` in `audio-player.tsx`), so the player follows
the theme without a re-render.

### Wizard Steps
Three steps on the create page. Desktop: a row of 32px circles joined by 2px connector
lines that fill in Amethyst Glow as steps complete, the current step ringed at 30%. Mobile:
a "Step 2 of 3" line over a 6px progress bar. Transitions are 300ms.

### Processing State
A centred card with a 48px Amethyst Glow circle holding a spinning loader, ringed by a
slow `animate-ping` halo at 10%, with an elapsed-time counter in tabular figures. The
failed state swaps the halo for a 10% Ember circle and offers "Try Again" as an outline
button.

### Toasts
Sonner, bottom-right, themed through the `Toaster` wrapper. Used for every mutation
result; add-to-collection has real rollback.

## Do's and Don'ts

### Do:
- **Do** design in dark and verify in light, in that order, on every surface you touch.
- **Do** take colour from theme tokens, and add a token to both `:root` and `.dark` when
  one is missing.
- **Do** set spoken script text in Script type at 65ch, and choose every other column's
  width by its content type rather than inheriting `max-w-5xl`.
- **Do** express elevation as a lighter surface token with a Hairline border.
- **Do** keep the gradient on the play button and the played waveform, as a flat tint in
  light.
- **Do** verify at 390px wide, and wrap any new transition in `motion-safe:` or an
  equivalent `prefers-reduced-motion` guard.
- **Do** check that any face a token names is loaded in `layout.tsx` and referenced by its
  `--font-*` variable.

### Don't:
- **Don't** use a Tailwind palette class (`bg-amber-500/10`, `text-blue-700`,
  `text-emerald-600`) for anything a visitor sees.
- **Don't** add a `shadow-*` class to new code, or reach for a shadow to lift a surface
  on dark.
- **Don't** put the gradient on a CTA, a card header, a hero, or anything that is not the
  player.
- **Don't** set Lora on `body`, or any serif on buttons, nav, labels or form controls.
- **Don't** force dark on the landing page or anywhere else; `defaultTheme="system"`
  stays.
- **Don't** fix light mode in a way that changes the dark design.
