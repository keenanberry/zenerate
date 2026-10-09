# Nocturne Pass

**Status:** Done* — *the phone-in-hand checks (installed PWA, lock screen, Now Playing from the OS control) are the operator's, after merge; everything else was verified locally, with the completed-meditation player checked on a local harness because the local database holds no completed meditation
**Priority:** Ship-blocker for the brand pass — the largest task in Phase 3
**Depends on:** 19 (design skill), 20 (typography lands first)

## Why this blocks ship

The app is honest stock shadcn: `max-w-5xl` everywhere, `h-14` nav, `py-8` sections,
default radius, default cards. That is dev-tool density on a meditation product.

Meanwhile the palette's character is almost entirely unexpressed. `--accent`
(`oklch(0.7889 0.0802 359.9375)`, a rose) is defined and used nowhere. The light
background is `oklch(0.9777 0.0041 301.4256)` — chroma 0.004, effectively neutral grey.
All the amethyst is in the dark theme, which is currently treated as an afterthought.

Direction chosen during brainstorming: **Nocturne, dark-first, with one gradient moment
on the player.** Full rationale in `docs/superpowers/specs/2026-09-11-go-live-design.md`.
The brainstorm mockup lived in gitignored scratch and no longer exists; `DESIGN.md` at the
repo root is the surviving record of the direction (tokens, named rules, do's and don'ts),
and the `zenerate-design` skill is the working procedure. Read both before starting.

## Acceptance criteria

**Dark as the design target**
- [x] Every authed surface designed and reviewed in dark first, light verified after
- [x] `defaultTheme="system"` unchanged in `layout.tsx:36` — light stays first-class, it just stops driving decisions
- [x] Elevation on dark comes from surface lightness, not shadows (shadows are invisible on dark and read as smudge)
- [x] Light mode given enough chroma to feel like the same product — the current near-neutral background is the weak point

**The gradient moment**
- [x] Purple→rose gradient on the play button and the played portion of the waveform, using `--primary` and the currently-unused `--accent`
- [x] Soft radial glow behind the player in dark; the same gradient renders as a **flat tint** in light, not a glow
- [x] Gradient appears in the player and nowhere else — restraint is what keeps it a signature rather than a trend

**Rhythm and density**
- [x] Vertical spacing loosened throughout; the `py-8` / `h-14` / `gap-2` baseline is too tight for this product
- [x] Card padding increased for breathing room
- [x] Content width chosen per content type rather than `max-w-5xl` by default (prose narrow, grids wide)

**Script viewer**
- [x] Spoken lines brighten as they play, dim once passed
- [x] Pause / silence / sound markers styled as structural annotations, visually distinct from spoken text
- [x] Settle the open question from task 20: markers in italic serif or small-caps sans

**Verification**
- [x] Every route checked in dark and light: `/`, `/login`, `/dashboard`, `/create`, `/discover`, `/meditation/[id]`, `/collections/[id]`
- [x] Checked at phone width — this is about to become an installed PWA (390px emulated for every route; on a real phone and as an installed PWA: operator, after merge)
- [x] `prefers-reduced-motion` respected by any new transition

## Implementation notes

- Work through theme tokens in `globals.css`, not per-component overrides. If a change needs a raw colour value in a component, the token set is wrong.
- The `.dark` block (`globals.css:131+`) is where the real palette lives. Start there.
- **The rose lives in different tokens per theme.** In light, `--accent` is the rose
  (`oklch(0.7889 0.0802 359.9375)`). In dark, `--accent` is a plum hover surface and the rose
  is `--accent-foreground` (`oklch(0.8391 0.0692 2.6681)`, also `--chart-2`). A gradient built
  from `--primary` → `--accent` is purple-to-purple in dark. Give the gradient its own token
  pair (both blocks) rather than reaching through `--accent`.
- **Type is settled by task 20.** All three font tokens are wired through their `next/font`
  variables (DESIGN.md, the Loaded Face Rule); judge type decisions here against that.
- Do not touch the audio pipeline or data fetching. This is a presentation-layer task; keeping it that way makes it reviewable.
- `docs/ui-roadmap.md` items 12 (Animations) and the "Design System Refinements" section overlap with this. Fold in what's cheap, leave the rest on the roadmap, and prune what this task closes.

## Open questions

- Should the landing page force dark regardless of system preference, as a marketing surface? Tempting for consistency with the OG image, but overriding a user's stated preference on their first interaction is a bad first impression. Default: respect `system` everywhere, including the landing page. Task 22 assumes this.

## Outcome (2026-10-09)

**What shipped.** Four code commits and one bookkeeping commit on
`keenanberry/phase3-21-nocturne`:

1. `src/lib/meditation/timeline.ts` (+15 tests): where each script segment sits in the audio.
2. Tokens and primitives: light `--background` at chroma 0.015 (was 0.004) on the dark
   ground's hue; light `--input` moved to the hairline so field borders show; new
   `--gradient-start`/`--gradient-end`/`--gradient-foreground`, `--player-halo`,
   `--candle`/`--sage`/`--periwinkle`, `--card-hover`, `--track` in both blocks; the
   `player-halo` utility. Stock `shadow-sm`/`shadow-xs` removed from Card, Input, Textarea,
   Select trigger, Switch, the outline Button and the active Tab. Card padding 24px on a
   phone, 32px from `sm`.
3. The gradient player and the following script: 48px gradient play button; the played
   waveform carries the same gradient across its full width; halo glows in dark, flat tint
   in light; `ScriptPlaybackProvider` feeds the player's position to the script viewer,
   which brightens the spoken passage (with a 2px primary bar in the gutter) and dims passed
   ones; markers are small-caps sans annotations on a hairline.
4. Rhythm and widths across every page and component under Target (the settled steps are
   the table in DESIGN.md's Layout section). Status badges, markers and the duration warning
   are off the Tailwind palette.

**Decisions and why.**

- **Markers: small-caps sans, not italic serif.** Markers are instructions to the narrator,
  not words anyone reads aloud. Italic serif keeps them in the reading face and makes them
  read like stage directions inside the prose; small-caps sans moves them to the chrome
  register DESIGN.md already gives the sans ("serif for what is read, sans for what is
  operated"), so the eye skips them when reading and finds them when scanning. Geist ships
  no true small caps and synthesized ones are thin, so they are set as the existing Label
  type in capitals: no new type step.
- **Gradient token pair** rather than `--primary` → `--accent`, as the notes required. The
  gradient keeps its colours in light (Amethyst → Rose with a Midnight icon, contrast 4.5:1
  at the purple end, 8.7:1 at the rose); the Flat Tint Rule is applied to the halo, which is the only part
  that glows. That is how I read "the same gradient renders as a flat tint in light, not a
  glow".
- **Follow-along is estimated, not measured.** No per-segment timestamps exist. The
  pipeline concatenates one clip per segment with nothing between, so pauses, silences and
  sounds are exact, and speech is scaled from word counts to make the timeline end where the
  audio does. Error is confined to where one passage ends and the next begins.
- **Player colours follow the theme and the width live** (a MutationObserver on `<html>`'s
  class and a ResizeObserver on the waveform call `setOptions`), so a theme toggle no longer
  needs a reload and never recreates the player or drops the position.
- **Silences show progress:** a 2px bar floor (`barMinHeight`), because a meditation is
  mostly silence and its bars otherwise vanish.
- **Volume slider hidden below `sm`.** At 390px the controls row did not fit with it;
  phones use their hardware buttons. Mute stays.
- **Overlay shadows kept.** Dialog, sheet, popover, dropdown and the select list keep
  shadcn's shadow: they float over cards of their own lightness, and in light mode the
  shadow is what separates them. Recorded in DESIGN.md's Elevation section.
- **Widths:** meditation page 48rem, create wizard 42rem (it shows the script at 65ch on the
  Generate step, so 28-32rem was too narrow), legal prose 60ch in Body type, grids and track
  lists the full 64rem.
- `defaultTheme="system"` is unchanged; `src/app/page.tsx` changed only through shared
  tokens and primitives (task 22 owns it).

**Evidence.** `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm test` 178 passed
(16 files), `npm run build` passes. Visual verification in the PR body, in order. In
summary: 12 routes in dark at 1440 and 390, then light at both, by headless Chromium
screenshots plus a scripted overflow and box-shadow audit on every one (0px horizontal
overflow everywhere; the only remaining box-shadows are focus and selection rings);
follow-along checked by seeking to 45s (spoken passage at L 89 vs passed L 65 in dark,
L 26 vs L 45 in light; 0.7s fade, 0s under `prefers-reduced-motion`); in real Chrome,
Media Session reported the title, artist and `playing`, and a mid-playback theme toggle
recoloured the waveform while the same `<audio>` element played on. Token contrast, computed from the OKLCH values: light
`--candle`/`--sage`/`--periwinkle` are 5.6/5.8/6.0:1 on white and 5.1/5.3/5.5:1 on Paper;
dark ones are 10.1/6.9/8.1:1 on Raised Night. The impeccable detector
ran once over every changed file and reported one advisory (a 10px badge in the voice
picker), now fixed.

**Found along the way.**

- The local database has no completed meditation (all seven seeded ones are
  `script_ready`), so `/meditation/[id]` with the player cannot be seen locally without
  spending an ElevenLabs generation. I verified the completed state on a temporary,
  uncommitted route that rendered the real `AudioPlayer` + `ScriptViewer` +
  `ScriptPlaybackProvider` over a seeded script and a locally synthesized WAV laid out on
  that script's timeline. A seeded completed meditation with a small audio file in local
  storage would make this checkable by anyone; that is a seed change, so it is not done here.
- The unplayed waveform in `--border` was nearly invisible on a dark card; it now uses
  `--track` (Violet Shadow in dark).
- Card hover was a 50% Hush fill, which is darker-or-equal to Raised Night in dark: hover
  was invisible. It is now `--card-hover`, a lighter step.
- Light ghost-button hover is a rose fill (`--accent` is the rose in light). Unchanged;
  flagged for task 22, which reworks the landing header where it is most visible.
- The npm install that set up this worktree rewrote `package-lock.json`; it is not part of
  this change and is not committed.

