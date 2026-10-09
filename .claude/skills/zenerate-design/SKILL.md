---
name: zenerate-design
description: Use before editing anything a visitor sees in Zenerate: a component, page, layout, globals.css, theme tokens, fonts, icons, the landing page, or any className under src/. Also use when reviewing a UI change.
---

# Zenerate design

The design system is `DESIGN.md` at the repo root. It is the contract; this skill is how
to work inside it in this codebase.

## Before editing

1. Read `DESIGN.md`. Its Do's and Don'ts are the review checklist.
2. `grep -rn "<ComponentName>" src` for every place a component you are changing is
   rendered. Each is a surface to verify.
3. Pick the content width for the surface from DESIGN.md's Layout section. The
   `max-w-5xl` in `src/app/(app)/layout.tsx:22` is the shell, not the answer.

## Rules this codebase has already broken

A token table cannot catch these. Each names the rule, then where it is broken today.

**The Loaded Face Rule.** A font token is real only when `src/app/layout.tsx` loads the
face with `next/font` and the token references that face's CSS variable. `next/font`
registers each face under a hashed family name, so a token that names the family never
matches it: `--font-sans: Geist` (`globals.css:10`) and `--font-serif: "Lora"`
(`globals.css:48`, `:110`, `:166`) both fall back to system fonts today. Task 20 wires
them. Until it lands, use the class DESIGN.md's type scale calls for (`font-serif` for
Script and Headline) so the markup is right when the face arrives, and say in your report
that the face is unwired. Wiring it is task 20's job, done its way, not a side effect.

**The Token Rule.** Colour comes from the `--color-*` set in `globals.css:7-73`:
`bg-primary/10`, `text-accent-foreground`, `text-muted-foreground`, `bg-destructive/10`
and so on. When a state needs a colour the set lacks, add a token to both `:root` and
`.dark` and use it. Three files carry raw palette classes from before this rule; a change
that touches one of them replaces them with tokens:

- `src/components/script-viewer.tsx:36-64` (amber, blue, purple markers)
- `src/components/meditation-card.tsx:22-26` (status badges)
- `src/components/meditation-form.tsx:454` (duration warning)

**The Lightness Rule.** On a dark surface, elevation is the step from `--background` to
`--card`, never a shadow. New code carries no `shadow-*` class. The `shadow-sm` on
`src/components/ui/card.tsx:10` is stock shadcn and leaves in task 21.

**The One Gradient Rule.** The purple-to-rose gradient (`--primary` to `--accent`) belongs
to the play button and the played waveform in `src/components/audio-player.tsx`, and to
nothing else.

## Verify, in this order

Dark is the design target. Dark is designed in; light is checked in.

1. Dark, desktop width.
2. Dark, 390px wide. A Chrome window stops at about 500px, so use DevTools device
   emulation for this step.
3. Light, both widths. What differs from dark is the token values, not the layout.
4. Every surface from "Before editing" step 2, not only the one you worked in.
5. Any new transition: it is under `motion-safe:` or otherwise off under
   `prefers-reduced-motion`.
6. Once, after all edits: `~/.claude/skills/impeccable/scripts/impeccable detect --json
   <changed files>`. Fix what it reports. One run, not a loop.

The PR description lists what was checked, where, in this order. "Looked fine" is not a
check.
