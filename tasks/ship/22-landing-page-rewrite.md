# Landing Page Rewrite

**Status:** Done* (the installed-PWA check is the operator's, and needs task 24's manifest first)
**Priority:** Ship-blocker
**Depends on:** 20 (typography), 21 (Nocturne tokens)

## Why this blocks ship

The landing page is factually wrong. `src/app/page.tsx:15` advertises the audio pipeline
as **"(Coming soon)"** — it shipped in `f1e6a32` and `3d50021`. The single most impressive
thing the product does is described as unavailable.

Beyond the stale copy it's a standard four-feature icon grid: functional, and it reads as
a template. It's the first thing anyone sees, and after task 09 it's what
`zeneratestudio.com` resolves to.

## Acceptance criteria

**Correctness**
- [x] "(Coming soon)" removed from the audio feature — it ships
- [x] Every claim on the page verified against what the app actually does today
- [x] Footer links to `/terms` and `/privacy` (task 15)

**Content**
- [x] Hero leads with what makes this different from Calm or Headspace: you *make* the meditation, it isn't picked from a catalogue
- [x] The generation flow is shown, not just described — the most compelling thing here is watching a script stream in
- [x] One-line pitch used verbatim as the hero line: **"Meditations composed for you, not picked
      from a catalogue."** Locked 2026-10-09 in `PRODUCT.md`; tasks 23 and 26 reuse it
- [x] Honest about the free-tier quota rather than letting a new user discover the 3/month cap after signing up

**Design**
- [x] Built on the Nocturne tokens from task 21, with Lora headings from task 20
- [x] Respects system theme — does not force dark (see task 21's open question)
- [x] Real product surface visible above the fold, not just an icon grid
- [x] Works at phone width
- [ ] Verified as an installed PWA start page (operator, after merge; needs task 24's manifest)

## Implementation notes

- The four features in `page.tsx:5-31` are reasonable content; the problem is presentation and one wrong word. This is a rewrite of the page, not a rethink of the pitch.
- An autoplaying muted loop of a script streaming in would carry the product better than any static screenshot. Keep it small, respect `prefers-reduced-motion`, and never let it block first paint.
- `/discover` is public and already populated — linking a real meditation from the landing page is more persuasive than a mockup.
- The header currently duplicates nav markup from `src/components/nav.tsx`. Worth reconciling while here, but don't let it grow the task.

## Open questions

- Does the landing page need social proof at launch? With zero users, no. Leave the space and revisit — a fake testimonial is worse than none.

## Outcome (2026-10-09)

**What shipped.** `src/app/page.tsx` is rewritten on the Nocturne tokens with Lora headings:

- **Hero:** the locked pitch verbatim as the `h1` (Display type), a plain second-person
  paragraph, "Compose a meditation" (to `/login`, or `/create` when signed in) and "Listen to
  public ones" (`/discover`), and a one-line statement of the audio cap.
- **Product surface:** `src/components/script-stream-demo.tsx` streams an example script into
  the real `ScriptViewer`, two words every 90 ms, holds for 7 s, fades and loops. It runs only
  while on screen (an `IntersectionObserver`). The server renders the finished script as an
  invisible sizer in the same grid cell, so the card has its final height at first paint and
  CLS is 0. Under `prefers-reduced-motion` the CSS shows the sizer, hides the streamed layer
  and reads "Ready", and the effect never starts a timer.
- **The four features** are now the four steps of the flow ("Describe it", "Read the script",
  "Hear it", "Keep it"), in a numbered list on Hairline rules, not an icon grid.
- **"Hear one first"** shows the newest public, completed meditation, read at request time by
  `src/lib/landing/latest-meditation.ts`. The card has its title, its type and length, and its
  first spoken passage in Lora, and links to `/meditation/[id]`. When there is none, or the
  read fails, the section links to `/discover` instead and the page still renders.
- **"Free, at hobby scale"** covers both monthly caps, the reset on the 1st (UTC), the one free
  retry after a failed narration, that it is AI-written and AI-voiced, and a link to the Terms.
- **Header and footer:** the header is the shared `Nav` (the landing and legal layouts no
  longer carry their own markup), and the footer tagline lost its em dash.

**Decisions and why.**
- **Quota numbers come from `getQuotaConfig()` and `getScriptQuotaConfig()`**, the same
  functions the quota checks call, through `freeTierSummary` and `countOf` in
  `src/lib/landing/copy.ts`. If the environment changes a cap, the page changes with it.
- **"Ambient music" is gone from the audio claim.** `workflow.ts` can mix background music,
  but nothing in the UI sets `settings.music`, so a visitor cannot get it. "Natural TTS" became
  "narrates it in a voice you choose" (the voice picker). The lock-screen claim is left out
  until task 25's device checks pass.
- **The demo script is hand-written and labelled as an example.** It is in the model's
  markup, so it renders through the same parser and viewer as a real script. A live
  generation on the landing page would spend the Anthropic budget on every visit.
- **Legal layout reconciled too.** DESIGN.md said the legal header was duplicated as well
  and assigned both to this task. It now calls `getUser()`, which costs nothing extra: every
  route, `/_not-found` included, was already dynamic.
- **`Nav` fixes found by Lighthouse.** Below `sm` the labels were `hidden`, so the
  icon-only links had no accessible name on any page (`link-name` and `button-name` failed).
  They are `sr-only` now, the items are `Button asChild` links rather than a `<button>` inside
  an `<a>`, and the active item has `aria-current="page"`.
- **No social proof.** There are no users. The space is left, per the open question.

**Evidence.**
- `npm run lint`: 0 errors (3 warnings, all in files this task did not touch).
- `npx tsc --noEmit` is clean. `npm test`: 18 files, 188 tests pass, 10 of them new, in
  `src/lib/landing/{copy,stream}.test.ts`. `npm run build` passes.
- Lighthouse 13.5.0 in headless Chrome against `next start` (signed out, local Supabase):
  - mobile: performance 93, accessibility 100, best practices 100, SEO 100; LCP 3.2 s,
    CLS 0, TBT 0 ms.
  - desktop: performance 100, accessibility 100, best practices 100, SEO 100; LCP 0.7 s,
    CLS 0.

  Before the `Nav` and link fixes, mobile accessibility was 87. The mobile LCP element is the
  hero paragraph, held by the app-wide render-blocking CSS chunk under simulated slow 4G;
  the landing page adds nothing to it.
- Reduced motion, checked with puppeteer by emulating `prefers-reduced-motion`. With
  `no-preference` the stream went from 13 to 45 words in 1.5 s, with a 0.7 s fade
  transition. With `reduce` the stream layer is `display:none`, the full script is visible,
  the status reads Ready, 0 words are ever streamed, and the transition is 0 s.
- Visual order:
  1. Dark at desktop (1440 px).
  2. Dark at 390 px: a 390x844 frame, `scrollWidth` 390, 16 px gutters both sides.
  3. Light at 390 px, then at desktop.
  4. Every other usage site of `Nav` and `SiteFooter` in both themes: `/discover`, `/terms`,
     `/dashboard` and `/meditation/[id]` at desktop and 390 px.
  5. Signed out, under emulated system dark and light at 390 px and 1440 px: the `dark` class
     follows the system scheme, and the header reads Discover and Sign in.
- The impeccable detector over the changed UI files returns `[]`.

**Found along the way.**
- The local database has no public, completed meditation right now, so `/discover` and
  the landing page show their empty states. The card branch was checked against an
  uncommitted fixture, which was then removed. Nothing in the shared database or seed was
  changed.
- On phones the hero grid's implicit track grew to the demo's `nowrap` focus line, which
  left a 4 px right gutter. Fixed with `grid-cols-1`, which gives a `minmax(0, 1fr)` track.
- `bf-cache` fails Lighthouse on every page, because dynamic responses are sent `no-store`.
  This is app-wide and not in this task's scope.

