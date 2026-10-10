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
  paper: "oklch(0.9690 0.0150 300.0000)"
  paper-raised: "oklch(1 0 0)"
  paper-hover: "oklch(0.9860 0.0080 300.0000)"
  paper-muted: "oklch(0.8906 0.0139 299.7754)"
  paper-hairline: "oklch(0.8447 0.0226 300.1421)"
  lilac: "oklch(0.8957 0.0265 300.2416)"
  ink: "oklch(0.3651 0.0325 287.0807)"
  ink-soft: "oklch(0.5288 0.0375 290.7895)"
  amethyst: "oklch(0.6104 0.0767 299.7335)"
  rose: "oklch(0.7889 0.0802 359.9375)"
  rose-ink: "oklch(0.3394 0.0441 1.7583)"
  ember-light: "oklch(0.6332 0.1578 22.6734)"
  candle-ink: "oklch(0.5200 0.0900 70.0000)"
  sage-ink: "oklch(0.5000 0.0700 170.0000)"
  periwinkle-ink: "oklch(0.5000 0.0800 258.0000)"
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
    padding: "32px"
  card-hover:
    backgroundColor: "{colors.well}"
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
    height: "64px"
  brand-mark:
    textColor: "{colors.amethyst-glow}"
    size: "22px"
  play-button:
    backgroundColor: "linear-gradient(135deg, oklch(0.7058 0.0777 302.0489), oklch(0.8391 0.0692 2.6681))"
    textColor: "{colors.midnight}"
    rounded: "{rounded.full}"
    size: "48px"
  script-cue:
    textColor: "{colors.candle}"
    typography: "{typography.label}"
    padding: "4px 0"
---

<!-- Colours, radius and spacing are extracted from src/app/globals.css as shipped. The
typography scale and the named rules record the Nocturne direction approved 2026-09-11
(docs/superpowers/specs/2026-09-11-go-live-design.md), which the Nocturne pass (task 21)
landed on 2026-10-09. Where the code lags a rule, the rule names the task that closes the
gap. -->

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

The anti-reference for rhythm is the stock shadcn the app started as: `h-14` navigation,
`py-8` sections, `gap-2` rows and `max-w-5xl` on every column regardless of content. The
Nocturne pass (task 21) replaced it with the steps recorded under Layout; a change that
drifts back toward that density is a regression.

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
  `--accent-foreground` (and `--chart-2`): a hover text colour on ghost buttons. Its light
  counterpart, **Rose** (`oklch(0.7889 0.0802 359.9375)`), ships as `--accent`. Because
  the two themes put the rose in different tokens, the player gradient has its own pair in
  both blocks: `--gradient-start` (Amethyst Glow in dark, Amethyst in light) and
  `--gradient-end` (Rose Quartz in dark, Rose in light), with `--gradient-foreground`
  (Midnight in both) for the icon on top. Nothing but the player reads them.
- **Violet Shadow** (`oklch(0.4604 0.0472 295.5578)`): secondary fills, badges, the
  selected nav item.

### Tertiary
- **Sage** (`oklch(0.7321 0.0749 169.8670)`), **Candle** (`oklch(0.8540 0.0882 76.8292)`),
  **Periwinkle** (`oklch(0.7857 0.0645 258.0839)`): the three non-violet hues the theme
  defines (`--chart-3..5`), and since task 21 named tokens of their own: `--sage`,
  `--candle` and `--periwinkle` (`text-sage`, `bg-candle/10`). In light they take darker
  inks so they hold up as text on white and on Paper: **Sage Ink**
  (`oklch(0.5000 0.0700 170.0000)`), **Candle Ink** (`oklch(0.5200 0.0900 70.0000)`),
  **Periwinkle Ink** (`oklch(0.5000 0.0800 258.0000)`). Candle is in progress and the
  pause marker and the duration warning; Periwinkle is waiting on you and the silence
  marker; Sage is done and the sound marker.
- **Ember** (`oklch(0.6875 0.1420 21.4566)`): destructive and failed states only.

### Neutral
- **Deep Night** (`oklch(0.1985 0.0200 293.6639)`): the lowest surface; sidebar token,
  available for a future footer or rail.
- **Midnight** (`oklch(0.2166 0.0215 292.8474)`): the page ground in dark.
- **Raised Night** (`oklch(0.2544 0.0301 292.7315)`): cards and popovers. One step above
  the ground; that step is the elevation.
- **Hush** (`oklch(0.2560 0.0320 294.8380)`): muted fills, skeletons, the waveform
  placeholder.
- **Well** (`oklch(0.2847 0.0346 291.2726)`): `--input`, and `--card-hover`, the step a
  raised card takes under the pointer.
- **Plum Hover** (`oklch(0.3181 0.0321 308.6149)`): hover surface for ghost and outline
  buttons.
- **Hairline** (`oklch(0.3063 0.0359 293.3367)`): every border and rule.
- **Violet Shadow** doubles as `--track` in dark: the unfilled part of anything that
  fills, the unplayed waveform and the volume slider. Hairline was too faint for it.
- **Moonlit** (`oklch(0.9053 0.0245 293.5570)`): text.
- **Dusk** (`oklch(0.6974 0.0282 300.0614)`): secondary text, timestamps, labels.
- Light: **Paper** ground (`oklch(0.9690 0.0150 300.0000)`; task 21 raised its chroma from
  0.004 so the light theme reads as lilac paper, the same room, rather than grey),
  **Paper Raised** white cards, **Paper Hover** (`oklch(0.9860 0.0080 300.0000)`) as
  `--card-hover`, **Ink** text (`oklch(0.3651 0.0325 287.0807)`), **Ink Soft** secondary
  text, **Lilac** secondary fills, **Paper Hairline** borders, field borders (`--input`)
  and `--track`.

### Named Rules
**The Token Rule.** Every colour in a component comes from a theme token: `bg-primary/10`,
`text-muted-foreground`, `border-border`, `bg-destructive/10`. A Tailwind palette class
(`amber-500`, `blue-700`, `emerald-600`) is a missing token; add the token to both `:root`
and `.dark` in `globals.css` and use it.

**The One Gradient Rule.** `--gradient-start` to `--gradient-end` (Amethyst Glow to Rose
Quartz in dark) appears on the play button and the played portion of the waveform. It
appears nowhere else: not on CTAs, not on card headers, not on the hero. The halo behind
the player is a radial glow in dark and a flat tint in light (`--player-halo`).

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
  markers in the script viewer, where it is set in capitals as small-caps sans (settled in
  task 21: markers are instructions to the narrator, not words to read, so they leave the
  reading face; italic serif would read as part of the script). Geist ships no true small
  caps, so capitals at Label size stand in for them rather than synthesized ones. Geist.
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
16px gutter (24px from `sm`). That width is the widest column, sized for card grids;
every other content type narrows itself inside the shell:

- Grids and tabular lists of meditations or collections (`/dashboard`, `/discover`,
  `/collections/[id]`): the full 64rem.
- A meditation (`/meditation/[id]`): 48rem (`max-w-3xl`), which holds the player and a
  card whose script runs at 65ch.
- The create wizard: 42rem (`max-w-2xl`). Wider than a plain form because the Generate
  step shows the script at 65ch inside a card; the template grid is three columns at
  most.
- Login and dialogs: a single 28rem card (`max-w-md`).
- Legal pages: the 48rem `(legal)` column with the article itself at 60ch in Body type.
- Descriptions under a title (meditation prompt, collection description): 60ch.

The navigation is a single 64px bar with the lowercase wordmark on the left, section links
beside it (icons only below `sm`), and theme toggle plus sign-in/out on the right. One
component (`src/components/nav.tsx`) renders it for the app shell, the landing page and
the legal layout (task 22).

Vertical rhythm, as settled in task 21:

| Step | Value |
|---|---|
| Nav bar | 64px (`h-16`) |
| Shell to content | 40px on a phone, 56px from `sm` (`py-10 sm:py-14`) |
| Between page sections (header, player, script, tabs) | 40px (`space-y-10`) |
| Title to its description | 8px (`space-y-2`) |
| Eyebrow link to title block | 12px (`space-y-3`) |
| Tabs to their content | 32px (`mt-8`) |
| Card padding | 24px on a phone, 32px from `sm` (`py-6 sm:py-8`, `px-6 sm:px-8`) |
| Inside a card, between blocks | 24px (`gap-6` / `space-y-6`) |
| Grid gutters | 24px (`gap-6`) |
| Track list rows | 14px vertical (`py-3.5`) |
| Between script passages and markers | 24px (`space-y-6`) |
| Empty states | 64px vertical (`py-16`) |
| Footer | 40px (`py-10`) |

The landing page (task 22) runs every section on the 64rem column with one left edge,
`py-16 sm:py-20` between Hairline rules; the hero is `py-14 sm:py-20`. Prose inside a
section narrows to 48rem and its paragraphs to 60ch, so the column edge stays shared while
the measure stays readable.

Breakpoints are Tailwind defaults (`sm` 640px, `md` 768px, `lg` 1024px). The phone target
is 390px wide, because the next step for this product is an installed PWA. Everything must
work there without horizontal scroll.

## Elevation & Depth

Tonal layering, no shadows. Depth in dark is the step from Deep Night to Midnight to
Raised Night to Plum Hover: lower surfaces are darker, raised surfaces are lighter, and a
1px Hairline border marks the edge. Shadows are invisible on a dark ground and read as
smudge, so they carry no information here.

The theme still defines a shadow vocabulary (`--shadow-2xs` to `--shadow-2xl`, 6% black),
but nothing in the page flow uses it. The inherited shadows are gone (task 21): `Card`,
`Input`, `Textarea`, the `Select` trigger, `Switch`, the outline `Button` and the active
`Tab` carry no `shadow-*`. Hover on a raised card is `--card-hover`, a lighter surface.

The one exception left in the code is the floating layer: dialogs, sheets, popovers,
dropdown menus and the select list keep shadcn's `shadow-md`/`shadow-lg`. They float over
arbitrary content, including cards of their own lightness, and in light mode the shadow
is what separates them; in dark it is all but invisible and the Hairline border does the
work. New code adds none.

The one place depth is lit rather than stepped is the player: a soft radial glow from
`--gradient-start` fading through `--gradient-end` behind it in dark, larger than the card
so it spills past the edges. In light, the same place is a flat 9% tint of
`--gradient-start` drawn just past the card's edge (`--player-halo`, `player-halo`
utility).

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
(empty states lost theirs in task 21).

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
- **State:** meditation status badges on cards take a 10% fill and text of a token:
  Generating is Candle, Script Ready Periwinkle, Processing Audio Amethyst (`--primary`),
  Completed Sage, Failed Ember (`--destructive`).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Raised Night in dark, white in light; Moonlit / Ink text.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 24px on a phone, 32px from `sm`, with 24px between blocks. A
  meditation card is a whole-card link with the play and favourite controls layered above
  it; its title is Lora at 1.125rem, and hover is `--card-hover` (Well in dark, Paper
  Hover in light).

### Inputs / Fields
- **Style:** 36px tall, 6px radius, 1px Hairline border, transparent in light and 30% Well
  in dark, 12px horizontal padding, Body type (0.875rem from `md` up).
- **Focus:** border to `--ring` and the 3px ring.
- **Error:** border and ring to Ember at 20% (40% in dark). **Disabled:** 50% opacity.
- The raw script editor is a `textarea` in Mono at 400px minimum height.

### Navigation
- A 64px bar, `border-b`, 95% Midnight with backdrop blur. Wordmark `zenerate` in bold
  tracking-tight at 1.125rem. Items are ghost buttons (`asChild` links) with a 16px icon
  and a label that is `sr-only` below `sm`, never `hidden`, so the icon-only items keep an
  accessible name; the active item is `secondary` with `aria-current="page"`. The theme toggle is an icon button whose sun
  and moon cross-fade with a rotate.
- The wordmark has the Brand Mark beside it at 22px, in `text-primary`, veins off.
- A page that belongs to a section (a meditation, a collection) carries an eyebrow
  above its title (`src/components/parent-link.tsx`): a Label-type link in Dusk with a
  12px arrow, no box and no "Back", lifting to Foreground on hover. It names where the
  page lives rather than promising a history it cannot honour, so the owner's meditation
  says Library and anyone else's, including a signed-in visitor on a shared link, says
  Discover. It replaced a ghost button that sat in its own 24px band and read as an
  action beside the real ones.

### Brand Mark
The bodhi leaf, `BrandMark` in `src/components/brand-mark.tsx`, drawn in `currentColor`:
colour comes from a text token, size from `size-*`. Veins are cut out of the leaf only at
64px and above (the login card); below that it is the silhouette (nav, favicon). Never
filled with a gradient: the gradient belongs to the player.

### Script Viewer (signature)
The reading surface. Spoken passages are Script type at a 65ch measure, 24px apart, with
no icon in front of them. Between them sit structural markers for pause, silence and
sound: each is one unfilled row of a 14px icon and the marker name in small-caps sans
(Label type in capitals) in its token colour, the value in Dusk (`5 sec`, `1 min`, or the
sound by name, "tibetan bell"), and a Hairline rule running to the edge. They read as
annotations on the script, not as part of it: the eye skips them when reading and finds
them when scanning. Pause is Candle, silence Periwinkle, sound Sage.

On the meditation page the viewer follows the player (`ScriptPlaybackProvider` in
`script-playback.tsx`). Until playback first starts every passage is Moonlit. Once it has,
the passage being spoken is Moonlit with a 2px Amethyst Glow bar in the card's left
padding, upcoming passages sit at 80%, and passed ones dim to Dusk; passed markers drop
to 60% opacity. The fade is 700ms under `motion-safe:` and instant otherwise. Where a
passage sits in the audio is estimated (`src/lib/meditation/timeline.ts`): pauses,
silences and sounds have exact lengths, and speech is scaled from its word count so the
timeline ends where the audio does. Outside the meditation page (the create wizard, the
script editor) there is no player, and the viewer stays evenly lit.

### Audio Player (signature)
A card holding the waveform above a row of controls: a 48px round play/pause button, a
tabular-figure time readout in Dusk, and download, mute and (from `sm`) volume controls
on the right. Phones use their hardware volume, so the slider is hidden below `sm`.
Download and mute carry the shared Tooltip (300ms, from the root layout's provider), as
the play buttons in lists do; a native `title` is too slow to notice and does not match.

The play button and the played waveform are the gradient moment: the button is a
`--gradient-start` to `--gradient-end` circle with a Midnight icon (`hover:brightness-110`,
a `motion-safe:` press scale), and the played bars are the same gradient laid across the
waveform's full width, so the rose arrives as the session ends. Unplayed bars are
`--track`, the cursor is `--gradient-end`, and every bar has a 2px floor so a long silence
still shows progress. Behind the card sits the halo (see Elevation); in dark the card is
at 90% so the glow reads through its edge.

Colours are read from the CSS variables (`waveformColors` in `audio-player.tsx`) at
creation and again whenever `<html>`'s class or the waveform's width changes, so a theme
toggle recolours the player without recreating it or losing the playback position. The
Media Session binding (`use-media-session.ts`, task 25) sits outside the markup and is
unaffected by the styling.

### Wizard Steps
Three steps on the create page. Desktop: a row of 32px circles joined by 2px connector
lines that fill in Amethyst Glow as steps complete, the current step ringed at 30%. Mobile:
a "Step 2 of 3" line over a 6px progress bar. Transitions are 300ms.

### Processing State
A centred card with a 48px Amethyst Glow circle holding a spinning loader, ringed by a
slow `motion-safe:animate-ping` halo at 10%, with an elapsed-time counter in tabular figures. The
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
- **Do** keep the gradient on the play button and the played waveform, and keep the halo
  behind the player a glow in dark and a flat tint in light.
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
