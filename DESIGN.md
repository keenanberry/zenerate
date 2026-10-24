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
  cover-ground: "oklch(0.1985 0.0200 293.6639)"
  cover-rose: "oklch(0.7900 0.0650 10.0000)"
  cover-clay: "oklch(0.7600 0.0700 45.0000)"
  cover-moss: "oklch(0.7600 0.0650 130.0000)"
  cover-tide: "oklch(0.7600 0.0600 205.0000)"
  cover-mist: "oklch(0.8000 0.0350 235.0000)"
  cover-heather: "oklch(0.7400 0.0700 335.0000)"
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
  paper-cover: "oklch(0.9350 0.0200 300.0000)"
  cover-rose-ink: "oklch(0.5300 0.0850 10.0000)"
  cover-clay-ink: "oklch(0.5200 0.0850 45.0000)"
  cover-moss-ink: "oklch(0.5000 0.0700 130.0000)"
  cover-tide-ink: "oklch(0.5000 0.0700 205.0000)"
  cover-mist-ink: "oklch(0.5400 0.0450 235.0000)"
  cover-heather-ink: "oklch(0.5200 0.0850 335.0000)"
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
in the studio before it is heard; the interface around it is a quiet sans that stays out
of the way. Once a meditation exists it is listened to: its page leads with one Play, and
the session it opens is the darkest, quietest view in the app.

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
Meditation covers are not an exception: they are flat tone fields (see Covers).
A transparency mask is not a gradient in this sense: a `mask-image` ramp from `transparent`
to `black` sets only alpha, so it shows the surface's own token colours fading out and adds
no hue. The landing demo's script window fades its scrolled-away lines this way.

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
- **Mono** (400, 0.875rem, 1.625): error digests. Geist Mono.

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
- A meditation (`/meditation/[id]`): 48rem (`max-w-3xl`). On a phone the cover runs the
  full width, then the meta line, the title with the heart and "…", one full-width Play,
  the description, and "Show script" (task 55). From `sm` the cover sits at 160px beside
  the rest and Play takes its own width. The script, when shown, runs at 65ch.
- The studio's front door (`/create`): 42rem (`max-w-2xl`), one large input with the
  Recent drafts below it as a ruled list.
- The studio (`/create/[chatId]`): the full 64rem, as two panes from `md`. The chat column
  is 20rem (24rem from `lg`) and the canvas takes the rest. Inside the 64rem shell that
  sets the script at about 45ch (502px at `lg`), under its 65ch cap but still a
  comfortable measure; letting the studio run wider than the shell is the lever if it
  reads cramped. Both panes fill the viewport under the nav, less
  the shell's padding, and scroll on their own, with the composer at the bottom of the
  chat. Under `md` the chat fills the column and the canvas is a bottom sheet.
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
| Track list rows | at least 72px tall, 12px vertical inside the text (`py-3`), Hairline inset dividers |
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
at 6px (`rounded-md`), badges, avatars, the play button and the studio's "Script updated" pill fully
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
- **No status badges (task 54).** A meditation with audio is the normal case and says
  nothing. The exceptions get one 14px icon (`AudioStatusIcon`) before the meta line, named
  for screen readers and in a tooltip: a script with no audio yet (file, Dusk), audio or a
  script being made (spinner, Amethyst, `motion-safe:`), audio that failed (alert, Ember).
  The meditation page has no badge at all; its audio section already says the state.
- **Tags are not listed.** Tag pills (`TagPills`) appear only where a tag is edited or
  filtered: the meditation page's edit form, the studio canvas and Discover's filters. Read
  only, the meditation page sets its tags as Dusk links into Discover on one line with
  the length and date, each `·` ending the item before it so a wrap never opens a line
  with one (task 54). A list, a shelf
  or a card names a meditation's first tag in its meta line instead (task 48); two or more
  filled pills per row outweighed the title and read as a to-do app.

### Track Rows
A meditation in a list (`TrackRow`, in the Library, Favorites and a collection) is drawn
as a music app draws a track (task 48):

- The 56px cover, then the title in Body type (16px, 500, Foreground, one line ending in
  "…"), and under it one meta line in Dusk at 14px (`text-sm`) with tabular figures: first tag ·
  length · date (`metaLine` in `src/lib/meditation/meta.ts`). Shelf cards and the landing
  page's cards use the same line without the date. No header row, no Type column.
- **Inset dividers:** a Hairline rule above every row but the first, starting where the
  text starts, so the covers keep a clean column (the Apple Music pattern).
- **Playing:** from `sm`, an index column shows the number and a play icon on row hover,
  and the row's title turns Primary while it plays. Below `sm` there is no index column
  and nothing plays in place: the whole row, cover included, opens the meditation's
  page, as Insight Timer does (task 55). A meditation is chosen and committed to, so
  Play lives on its page.
- Every icon-only control in a row has an accessible name naming the meditation.

### Collections
A collection is drawn as a playlist (task 54), not a card: square artwork, then the name
in Lora and a Dusk line of the count and description, with the menu beside the name.
`CollectionArtwork` is built from the first covers so it reads as a set: two side by
side, three as a half and two quarters, four or more as a 2x2 mosaic, each cropped to its
cell (`crop` on `MeditationCover`). One shows its cover whole; an empty collection draws a
quiet cover of its own. The Library grid is
two columns on a phone, three from `sm`, four from `lg`; the collection page header sets
the artwork at 160px beside the name, as the meditation page does.

### Menus
Every dropdown, select and picker shares one look (the Discover filters, the collection
menu, the meditation page's "…" and the session view's, Add to collection, the tag
picker):

- **Surface:** `--popover` with a Hairline border, 6px radius and 4px of padding; its
  shadow is the floating-layer exception under Elevation.
- **Items:** 14px Body type in Foreground, 6px horizontal and 6px vertical padding, 4px
  radius, inset from the edge. The highlighted item (hover or keyboard) takes
  `--menu-hover`, a step that shows on the popover in both themes, and keeps its text
  colour. Never `--accent`, which turned the text rose and belongs to ghost buttons.
- **Group headings:** Label type in capitals (12px, 500, 0.06em, Dusk) with 12px above,
  and a Hairline separator before each group, so a long list reads as sections.
  `SelectLabel` and `DropdownMenuLabel` both carry it.

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
- The studio composer is the same field at 48px minimum, growing with its text to 160px,
  with a 32px send (or stop) icon button inside its bottom-right corner.

### Navigation
- A 64px bar, `border-b`, 95% Midnight with backdrop blur. Wordmark `zenerate` in bold
  tracking-tight at 1.125rem. Items are ghost buttons (`asChild` links) with a 16px icon
  and a label that is `sr-only` below `sm`, never `hidden`, so the icon-only items keep an
  accessible name; the active item is `secondary` with `aria-current="page"`. The theme toggle is an icon button whose sun
  and moon cross-fade with a rotate.
- The wordmark has the Brand Mark beside it at 22px, in `text-primary`, bold tier.
- A page that belongs to a section (a meditation, a collection) carries an eyebrow
  above its title (`src/components/parent-link.tsx`): a Label-type link in Dusk with a
  12px arrow, no box and no "Back", lifting to Foreground on hover. It names where the
  page lives rather than promising a history it cannot honour, so the owner's meditation
  says Library and anyone else's, including a signed-in visitor on a shared link, says
  Discover. It replaced a ghost button that sat in its own 24px band and read as an
  action beside the real ones.

### Brand Mark
A lotus in line art, `BrandMark` in `src/components/brand-mark.tsx`, drawn in
`currentColor`: colour comes from a text token, size from `size-*`. Five petals as open
strokes over a base line, three dots above; each side petal's inner edge ends on its
neighbour's outline, so no line crosses another. Two tiers, both in
`src/assets/brand/mark.svg`: the ink weight (stroke 5 on the 100-unit grid) with base and
dots from 32px up, and the bold weight (8.5) with the petals alone below that, where the
lines would close up. `bold` on the component and the size in the icon build choose the
tier; the dots turn Rose Quartz from 64px, otherwise they take the ink. Every raster in
`public/` and the favicon are rebuilt from the SVG by `scripts/build-icons.ts`; a test
keeps the component's copy of the geometry in step. Chosen 2026-10-09 over the bodhi
leaf (task 23), which read as a generic leaf at nav size.

### Script Viewer (signature)
The reading surface. Spoken passages are Script type at a 65ch measure, 24px apart, with
no icon in front of them. Between them sit structural markers for pause, silence and
sound: each is one unfilled row of a 14px icon and the marker name in small-caps sans
(Label type in capitals) in its token colour, the value in Dusk (`5 sec`, `1 min`, or the
sound by name, "tibetan bell"), and a Hairline rule running to the edge. They read as
annotations on the script, not as part of it: the eye skips them when reading and finds
them when scanning. Pause is Candle, silence Periwinkle, sound Sage.

On the meditation page the script is closed behind "Show script" (`ScriptDisclosure` in
`meditation-page.tsx`, task 55): a Dusk UI-type row on a Hairline rule with a chevron,
and the session view's "…" can open it. Shown, the viewer follows the player
(`ScriptPlaybackProvider` in `script-playback.tsx`). Until playback first starts every passage is Moonlit. Once it has,
the passage being spoken is Moonlit with a 2px Amethyst Glow bar in the card's left
padding, upcoming passages sit at 80%, and passed ones dim to Dusk; passed markers drop
to 60% opacity. The fade is 700ms under `motion-safe:` and instant otherwise. Where a
passage sits in the audio is estimated (`src/lib/meditation/timeline.ts`): pauses,
silences and sounds have exact lengths, and speech is scaled from its word count so the
timeline ends where the audio does. Outside the meditation page (the studio canvas, the
landing demo) there is no player, and the viewer stays evenly lit.

### Covers
Every meditation has a designed cover, `MeditationCover` in
`src/components/meditation-cover.tsx`, until generated artwork ships
(`tasks/post-ship/generated-cover-art.md`). It takes `{ id, tags, title, size }` and
is square from 48px (track rows) to 320px; the library card shows it at 64px and the
meditation page header at 160px.

- **Derived, never stored.** The first tag in the vocabulary picks a pair of hues, and
  no two tags share a pair (`TAG_HUES`); no tag, or only tags outside the vocabulary,
  draws in Dusk alone on a quiet field. A 32-bit FNV-1a hash of the id picks which hue leads, whether the
  picture is mirrored, and the motif, and seeds its composition (scale, position, layer
  count, density), so a meditation draws the same cover on every render and device. The
  markup carries token classes, never colour values, so a theme toggle recolours it.
- **Ten hues.** Amethyst, Periwinkle, Sage and Candle from the state set, plus six
  cover-only tokens that appear nowhere else: `--cover-rose`, `--cover-clay`,
  `--cover-moss`, `--cover-tide`, `--cover-mist` and `--cover-heather`. Like the state
  hues they are muted and nocturnal (chroma 0.035 to 0.07 at about 0.76 lightness in
  dark) and drop to ink weight in light (about 0.52), so a cover never turns neon on
  Deep Night or washes out on Paper.
- **Fourteen motifs, most not round.** Moon, ripples, orbit and the cropped lotus are
  drawn around a circle; the other ten are not: three hills of dusk, layered dunes, tide
  lines, a mountain ridge, a starfield, rain over a pool, a frond of leaves, a cairn of
  stones, aurora curtains as stepped columns of tone, and a doorway arch. Two times in
  three the hash picks from motifs that suit one of the meditation's tags (sleep leans to
  moon, starfield and orbit; grounding to stones, ridge and hills; breathwork to waves
  and ripples), otherwise from all fourteen. Round motifs come to about a third of
  covers.
- **The lead hue fills the frame (task 49).** A cover is album art, not a window onto
  the page's dark: a flat field of the lead hue covers the whole square
  (`--cover-field-<hue>`, about L 0.40 / C 0.055 in dark and a pale L 0.89 / C 0.035 in
  light, plus a quiet field for untagged covers), and the motif draws boldly on it.
  Before task 49 the motif sat in faint lines on Deep Night, and at 48px most covers
  read as a dark square with a squiggle.
- **Flat tone planes, no gradient.** Shapes are filled or stroked in `currentColor`, with
  each motif's opacities scaled by 2.4 for the field and capped at 95% (`boost`).
  Layering opacities gives the depth a gradient would; nothing glows.
- **Shape:** 6px radius under 96px, 12px from 96px, no border: the field is the edge.
  Strokes hold a bold, steady on-screen weight (2px in rows, 2.5px up to 160px, 3px
  above), and covers under 96px drop their finest detail: fewer rings, stars, drops,
  leaves and layers, drawn larger.
- **Discover's category tiles are covers too.** Each tile is its category's field, with
  a cover for the category (id `category:<slug>`, its first tag) cropped into the right
  edge and faded in through an alpha mask, and the label in Lora on plain field
  (`category-grid.tsx`). No icons.
- **The session view's ground.** The session player draws the cover at 600 (strokes
  hold 3px at that scale) cropped across the top of the view, fading to `--night`.
- **Decorative by default.** A cover sits beside its title, so it is `aria-hidden`;
  `decorative={false}` names it with the title where it stands alone.
- **Not on the lock screen.** The Media Session artwork stays the brand icon: the OS
  needs a raster URL, and a per-meditation cover would mean resolving the tokens and
  rasterizing client-side for a surface only a phone can verify.

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

Colours are read from the CSS variables on the waveform's own element
(`waveformColors` in `use-waveform-player.ts`) at creation and again whenever `<html>`'s
class or the waveform's width changes, so a theme toggle recolours the player without
recreating it or losing the playback position. The Media Session binding
(`use-media-session.ts`, task 25) sits outside the markup and is unaffected by the
styling.

This card is the player in the studio and for earlier versions. The meditation page uses
the session player below; both are skins over `useWaveformPlayer`, which owns the
wavesurfer instance and everything bound to its `<audio>`.

### Session Player (signature)
The meditation page's player (`session-player.tsx`, task 55, after Insight Timer). The
page shows one Play: a 48px solid Primary button, full width on a phone, never the
gradient. Once started it reads "Playing · 13:52 left" or "Resume · 13:52 left", and it
reopens the session.

- **One element.** The session view is an overlay on the page, never a route, and it
  stays mounted while minimized (`invisible` and `inert`, not removed). One wavesurfer
  and one `<audio>` serve the page for its whole life, so the lock screen, play counts,
  downloads and the script sync never rebind, and minimizing never stops the audio.
- **Always dark.** A lights-down mode for eyes closed: the view carries the `dark` class
  in either theme, and its menu, portalled out, carries it too. It is the one surface
  that ignores the theme; the page under it still follows it.
- **Layout.** Full screen on a phone; from `sm`, a 28rem panel at 90% of the viewport's
  height (52rem at most) over the page dimmed to 80% `--night` with a backdrop blur. The
  meditation's cover fills the top 72% (`crop`) and fades into `--night` (Deep Night)
  through an alpha mask. Round 40px buttons at the top: a down chevron that minimizes
  and "…" (download, favourite, Show script).
- **Transport.** The gradient play/pause at 84px with the halo behind it, and 15-second
  skips either side (`SEEK_OFFSET_SECONDS`, the lock screen's interval): a circular arrow
  with the seconds set inside.
- **Time.** The remaining time is the large number, Lora at 3.75rem with tabular
  figures. Under it a slim 28px waveform is the progress bar, because it shows where the
  silences are; it seeks by tap and drag, and as a `slider` by arrow keys. Elapsed and
  remaining sit under it in Dusk, then the title in Lora and the meta line.
- **Keys and focus.** Opening focuses the chevron and keeps Tab inside; Escape
  minimizes and hands focus back to Play; Space plays and pauses. The page does not
  scroll behind it. The fade and the panel's rise are `motion-safe:` only.

### Landing Demo
The hero's product surface (`src/components/script-stream-demo.tsx`): a card that reads as
a moment in the studio. The person's request sits at its top as a Secondary-fill bubble
at 85% width on the right, as in the chat; below it a Label-type "Draft 1" with a
Writing/Ready state, the script streaming into the real Script Viewer, and, once it is
in, the agent's one-line reply in plain Body text below a Hairline rule. Under the card
a row of chips names the six examples (`src/lib/landing/examples.ts`). Chips are pills
in UI type at 12px with a Hairline border; the live one takes the Secondary fill, as the
active nav item does, and a tap streams that example from its first word. The loop walks
the six in order. The script sits in a window of fixed height (13rem at every width),
followed to its newest line as it streams, the way the studio canvas is, with lines
fading out under its top edge through an alpha mask (see The One Gradient Rule); the
window keeps the hero, headline to CTAs to card, inside a 1280x800 screen. Requests and
replies are short, so every one is rendered invisibly in its own grid cell and the card
holds the longest of each and never shifts. Under reduced motion the window shows the
start of the chosen script, fading out under its bottom edge instead, with its reply,
and chips swap them.

### Studio
The chat and its canvas (`src/components/studio/`), the way Claude builds an artifact:
the conversation on the left, the script on the right.

- **Chat (task 50):** the person's messages sit at 85% width on the right on the Card
  surface with a Hairline border, in Foreground: quiet, never the brightest thing on
  screen. The agent's replies are plain Body text on the ground, with no bubble. Each
  `writeScript` is a chip, not the script: a Card-surface button holding the 40px cover,
  the title in Lora once `setDetails` has named it, and "Draft 2 · 5 min" in Dusk below;
  hover `--card-hover`, and tapping it brings the canvas forward. While the draft streams
  a spinner sits on the cover and the label reads "Writing draft 2". `setDetails` is one
  Dusk line naming the title in Lora. Under a fresh draft the next step is two real
  buttons, a primary "Make the audio" with a waveform icon and an outline "Change
  something", with a Dusk hint line after the first draft. No Sparkles icon anywhere.
  Cards from other tools render through `renderStudioPart`.
- **Audio card (task 56):** summary first, so it fits one phone screen. A Voice row and a
  Background row, each a Label-type heading over the chosen name, a two-line Dusk
  description and a Sage note ("Same as last time", "Suggested for this one"), with an
  outline **Listen** button (Stop while playing) and a link-style Change. Change opens a
  list in place: one row per option, a Primary check on the chosen one, the name with
  the gender in Dusk, the description wrapping to at most two lines, and its own Listen;
  hover and the chosen row take `--card-hover`. One preview plays at a time. The meditation
  page's Generate Audio panel uses the same rows (`src/components/audio-choices.tsx`).
  The chat scrolls the card's top into view when it appears, not its bottom.
- **Starting a render:** the Make audio button stays at full strength with a spinner and
  "Starting…" while the request runs (`aria-busy`, no pointer events); `disabled` would
  fade it to half opacity, which read as a stuck overlay on a phone.
- **Canvas:** a Card that fills its column, header and body split by a Hairline rule. The
  header has a Label-type "Draft N" and the status on the right: "Writing" with a spinner,
  "About 10 min", or, more than 10% off target, the estimate and the target in Candle
  with a warning icon. A draft the turn never saved says "Not saved" in Candle, so a
  half-streamed script is never shown as saved. Below that sit the title in Lora at
  1.25rem and the tags as one Dusk line. The body is the Script Viewer, followed to its
  newest line while it streams until the reader scrolls up; a "Follow the writing" outline
  button then sits at the foot of the canvas until they return to the bottom. A script
  opened on a reload starts at its top.
- **Phone sheet:** under `md` the canvas opens as a bottom sheet at 88% of the viewport,
  top corners at 12px, with the close button in the canvas header. When a new draft
  arrives, a round Secondary pill sits in flow above the composer, "Writing the script"
  with a spinner while it streams and "Script updated" after, and tapping it opens the
  sheet.
- **Errors:** inline at the end of the conversation, in a 12px-radius block on a 10% Ember
  fill with a 30% Ember border and a "Try again" outline button, for a 429 and a broken
  stream alike. A reload that lands while a reply is still being written shows a Card
  saying so, with a Reload button.

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
- **Do** give a meditation its `MeditationCover` wherever it is listed, and keep covers
  flat tone fields in token hues.
- **Do** verify at 390px wide, and wrap any new transition in `motion-safe:` or an
  equivalent `prefers-reduced-motion` guard.
- **Do** check that any face a token names is loaded in `layout.tsx` and referenced by its
  `--font-*` variable.

### Don't:
- **Don't** use a Tailwind palette class (`bg-amber-500/10`, `text-blue-700`,
  `text-emerald-600`) for anything a visitor sees.
- **Don't** add a `shadow-*` class to new code, or reach for a shadow to lift a surface
  on dark.
- **Don't** put the gradient on a CTA, a card header, a hero, a cover, or anything that
  is not the player.
- **Don't** set Lora on `body`, or any serif on buttons, nav, labels or form controls.
- **Don't** force dark on the landing page or anywhere else; `defaultTheme="system"`
  stays. The session view is the one exception: a lights-down mode, dark by design.
- **Don't** fix light mode in a way that changes the dark design.
