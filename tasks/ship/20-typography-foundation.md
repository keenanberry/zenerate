# Typography Foundation

**Status:** Done
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

- [x] `Lora` loaded via `next/font/google` in `src/app/layout.tsx` alongside Geist, with a `--font-lora` CSS variable
- [x] `--font-serif` in `globals.css` resolves to the loaded variable rather than naming an unfetched family
- [x] Only the weights actually used are loaded (400/500/600, plus italic only if used) — every extra weight is bytes on first paint
- [x] `--font-mono` reconciled: the theme names `"Fira Code"` but `Geist_Mono` is what's loaded. Either load Fira Code or change the token to Geist Mono. It must not name a font that isn't there
- [x] Meditation script text in `script-viewer.tsx` set in Lora at ~`1.9` line-height
- [x] Script reading column constrained to ~`65ch` rather than inheriting `max-w-5xl`
- [x] Page headings set in Lora; UI chrome (buttons, nav, labels, form controls) stays Geist
- [x] `font-display: swap` so a slow font fetch never blanks the text
- [x] Verified in both light and dark, and at phone width

## Implementation notes

- `next/font/google` self-hosts at build time, so there's no runtime request to Google and no layout shift beyond the swap.
- Resist setting Lora on `body`. Serif for long-form reading and headings, sans for interface — mixing them is the point, and a global serif makes forms feel antique.
- The `~65ch` measure matters more than the font choice for readability. `max-w-5xl` on a column of prose is roughly twice the comfortable line length.
- `docs/ui-roadmap.md` already called for both of these under "Design System Refinements". This task closes that item; remove it from the roadmap when done.

## Open questions

- Lora italic for the `*[PAUSE]*` / `*[SILENCE]*` markers, or keep them in small-caps sans as structural annotations rather than prose? Task 21 settles this — it's a Nocturne question, not a typography one.

## Outcome (2026-10-09)

**What shipped.**
- `src/app/layout.tsx` loads Lora (400/500/600, normal only, `display: "swap"`) beside Geist
  and Geist Mono, and the three `variable` classes moved from `<body>` to `<html>`.
- `globals.css` declares `--font-sans: var(--font-geist-sans, sans-serif)`,
  `--font-serif: var(--font-lora, Georgia, serif)` and
  `--font-mono: var(--font-geist-mono, monospace)` in all three places (`@theme inline`,
  `:root`, `.dark`). "Fira Code" is gone.
- `script-viewer.tsx`: the column is `max-w-[65ch]` in Lora at 1.125rem; passages are
  `leading-[1.9]`. Markers gained only `font-sans` so they stay Geist inside the serif
  column; their colours and shape are task 21's. The passage icon moved from `mt-1` to
  `mt-2.5` to sit on the first line of the taller line box.
- Page and section headings are Lora at weight 500 (DESIGN.md's Display/Headline weight):
  the `h1` on dashboard, discover, create, collections/[id] and meditation/[id]; that
  page's "Generate Audio" and "Meditation Script" section titles; the login card title;
  the legal layout's `h1`/`h2`; the 404, root, `(app)` and global error titles. On the
  landing page only `font-serif` was added; its `font-bold` stays for task 22 and renders
  from the 600 face.
- Chrome stays Geist: buttons, nav, inputs, labels, badges, card titles in grids, the
  landing feature `h3`s and the voice-picker and wizard sub-headings.

**Decisions and why.**
- *Variables on `<html>`, not `<body>`.* Tailwind's preflight sets `font-family` on `html`
  from `--font-sans`. With the variable classes on `body`, `var(--font-geist-sans)` is
  undefined at `html` and body inherits the fallback. Moving them is what makes the token
  resolve.
- *A fallback inside `var()`.* `global-error.tsx` replaces the root layout, so no font
  variable exists there. `var(--font-geist-sans), sans-serif` would make the whole
  declaration invalid at computed-value time and drop that page to the browser's default
  serif; `var(--font-geist-sans, sans-serif)` gives it the system sans instead.
- *400/500/600 costs one file.* Lora is a variable font: next/font emits three
  `@font-face` rules (400, 500, 600) that all point at the same woff2
  (`8c2eb9ceedecfc8e-s.p.21935807.woff2`), so the weight list adds no bytes. 400 is the
  script, 500 the headings, 600 the landing's `font-bold` until task 22. No italic, since
  nothing sets Lora in italic; task 21 adds it if markers go italic serif.
- *The measure sits on the column, in Lora's `ch`.* The markers line up with the passages,
  and 65ch measures the face being read: 726px at desktop.
  Inside the 390px viewport the column is 308px and wraps naturally.

**Evidence.** Computed values in the running app (dev and `next start`, identical):
`document.body` → `Geist, "Geist Fallback"`; a script passage → `Lora, "Lora Fallback"`
(18px / 34.2px line-height); the meditation `h1` → `Lora, "Lora Fallback"`, weight 500.
The Network panel shows the Geist, Geist Mono and Lora woff2 served from
`/_next/static/media/`, and nothing from fonts.googleapis.com or fonts.gstatic.com. Every
route (`/`, `/login`, `/dashboard`, `/discover`, `/create`, `/collections/[id]`,
`/meditation/[id]`, `/terms`, `/privacy`, a 404) was swept in dark then light at 1280px
and 390px: headings Lora, body, buttons, inputs, labels and nav Geist, no horizontal
scroll. Lint (0 errors), `tsc --noEmit`, `npm test` (137 passing), `npm run build`, and the
Impeccable detector (`[]`) all pass.

**Found along the way.**
- *Family names are not hashed under Turbopack.* The premise that `--font-sans: Geist`
  matched nothing does not hold for this repo: Next 16 builds with Turbopack, which
  registers faces as `Geist` and `Lora` (with `Geist Fallback`/`Lora Fallback`), not
  `__Geist_…`. Measured on `next start`, the old literal `Geist, sans-serif` renders the
  same width as the new token (560.5px against 544.7px for system sans), so the UI was
  already in Geist. What was broken was Lora (never loaded) and Fira Code (never loaded).
  Wiring through the variable is still right: it brings the metric-matched fallback that
  keeps the swap from shifting layout, and it survives a webpack build, which does hash
  names. DESIGN.md and the `zenerate-design` skill now give that reason. The same claim
  appears in `21-nocturne-pass.md` ("`--font-sans` is as broken as `--font-serif`"); that
  file is task 21's, so it is left for that task to correct.
- `docs/ui-roadmap.md` "Spacing & Layout" still lists a ~65ch width for script reading.
  The script viewer now has it; the item was left in place because this task was scoped to
  the Typography items.
- The create wizard and the script editor also render `ScriptViewer`. Both only appear
  mid-generation, so they were checked by code, not in the browser: the editor's preview
  column is narrower than 65ch, so the cap never applies there.
