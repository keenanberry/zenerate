# Typography Foundation

**Status:** Not started
**Priority:** Ship-blocker for the brand pass — highest impact per unit of work in Phase 3
**Depends on:** 19 (design skill records the rules this establishes)

## Why this blocks ship

`src/app/globals.css` declares `--font-serif: "Lora", Georgia, serif` at lines **48, 110
and 166**. `src/app/layout.tsx` loads only `Geist` and `Geist_Mono`. Lora is never
fetched. Nothing in the app uses `font-serif` except a stray `font-mono` in
`script-editor.tsx:59`.

The amethyst-haze theme was chosen for a calm, literary feel and half of it — the serif —
was specified and silently dropped. Every meditation script currently renders in the same
UI sans-serif as the buttons around it.

This is the single change that most moves the app from "dashboard" to "reading surface",
and it is close to free.

## Acceptance criteria

- [ ] `Lora` loaded via `next/font/google` in `src/app/layout.tsx` alongside Geist, with a `--font-lora` CSS variable
- [ ] `--font-serif` in `globals.css` resolves to the loaded variable rather than naming an unfetched family
- [ ] Only the weights actually used are loaded (400/500/600, plus italic only if used) — every extra weight is bytes on first paint
- [ ] `--font-mono` reconciled: the theme names `"Fira Code"` but `Geist_Mono` is what's loaded. Either load Fira Code or change the token to Geist Mono. It must not name a font that isn't there
- [ ] Meditation script text in `script-viewer.tsx` set in Lora at ~`1.9` line-height
- [ ] Script reading column constrained to ~`65ch` rather than inheriting `max-w-5xl`
- [ ] Page headings set in Lora; UI chrome (buttons, nav, labels, form controls) stays Geist
- [ ] `font-display: swap` so a slow font fetch never blanks the text
- [ ] Verified in both light and dark, and at phone width

## Implementation notes

- `next/font/google` self-hosts at build time, so there's no runtime request to Google and no layout shift beyond the swap.
- Resist setting Lora on `body`. Serif for long-form reading and headings, sans for interface — mixing them is the point, and a global serif makes forms feel antique.
- The `~65ch` measure matters more than the font choice for readability. `max-w-5xl` on a column of prose is roughly twice the comfortable line length.
- `docs/ui-roadmap.md` already called for both of these under "Design System Refinements". This task closes that item; remove it from the roadmap when done.

## Open questions

- Lora italic for the `*[PAUSE]*` / `*[SILENCE]*` markers, or keep them in small-caps sans as structural annotations rather than prose? Task 21 settles this — it's a Nocturne question, not a typography one.
