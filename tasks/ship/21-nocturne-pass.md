# Nocturne Pass

**Status:** Not started
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
on the player.** Full rationale in `docs/superpowers/specs/2026-09-11-go-live-design.md`;
the approved mockup is preserved in `.superpowers/brainstorm/*/content/visual-direction.html`.

## Acceptance criteria

**Dark as the design target**
- [ ] Every authed surface designed and reviewed in dark first, light verified after
- [ ] `defaultTheme="system"` unchanged in `layout.tsx:36` — light stays first-class, it just stops driving decisions
- [ ] Elevation on dark comes from surface lightness, not shadows (shadows are invisible on dark and read as smudge)
- [ ] Light mode given enough chroma to feel like the same product — the current near-neutral background is the weak point

**The gradient moment**
- [ ] Purple→rose gradient on the play button and the played portion of the waveform, using `--primary` and the currently-unused `--accent`
- [ ] Soft radial glow behind the player in dark; the same gradient renders as a **flat tint** in light, not a glow
- [ ] Gradient appears in the player and nowhere else — restraint is what keeps it a signature rather than a trend

**Rhythm and density**
- [ ] Vertical spacing loosened throughout; the `py-8` / `h-14` / `gap-2` baseline is too tight for this product
- [ ] Card padding increased for breathing room
- [ ] Content width chosen per content type rather than `max-w-5xl` by default (prose narrow, grids wide)

**Script viewer**
- [ ] Spoken lines brighten as they play, dim once passed
- [ ] Pause / silence / sound markers styled as structural annotations, visually distinct from spoken text
- [ ] Settle the open question from task 20: markers in italic serif or small-caps sans

**Verification**
- [ ] Every route checked in dark and light: `/`, `/login`, `/dashboard`, `/create`, `/discover`, `/meditation/[id]`, `/collections/[id]`
- [ ] Checked at phone width — this is about to become an installed PWA
- [ ] `prefers-reduced-motion` respected by any new transition

## Implementation notes

- Work through theme tokens in `globals.css`, not per-component overrides. If a change needs a raw colour value in a component, the token set is wrong.
- The `.dark` block (`globals.css:131+`) is where the real palette lives. Start there.
- Do not touch the audio pipeline or data fetching. This is a presentation-layer task; keeping it that way makes it reviewable.
- `docs/ui-roadmap.md` items 12 (Animations) and the "Design System Refinements" section overlap with this. Fold in what's cheap, leave the rest on the roadmap, and prune what this task closes.

## Open questions

- Should the landing page force dark regardless of system preference, as a marketing surface? Tempting for consistency with the OG image, but overriding a user's stated preference on their first interaction is a bad first impression. Default: respect `system` everywhere, including the landing page. Task 22 assumes this.
