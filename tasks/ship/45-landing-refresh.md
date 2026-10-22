# Landing Page Refresh for the Studio

**Status:** Done (PR pending review)
**Priority:** Phase 6 (seed & open)
**Phase:** 6
**Depends on:** 22 (landing page), 30 (studio UI), 32 (versions), 35 (covers), 36 (Discover), 40 and 44 (ambience), 43 (next step after a draft)

## Why

The studio replaced the wizard, and ambience, versions and the new Discover have shipped, but
`/` still described the old app in four places:

1. The demo spoke wizard: a `FOCUS <focus>` header, chips labelled "Example focuses", and a
   caption saying "Choose a focus to see another".
2. The "Hear it" step left out ambience.
3. Nothing said you can come back after listening and revise.
4. "Hear one first" was one coverless text card.

Task 22's pitch, structure and Lighthouse bar (mobile 93) stand.

## Decisions

- **Each example is a request, typed as a person would type it in the studio**
  (`request` replaces `focus` in `src/lib/landing/examples.ts`), and carries the agent's
  closing `reply`. The replies follow task 43's prompt rule: the length rounded to the
  minute, then the choice between changing something and making the audio, worded for that
  meditation and never the same twice. Tests hold both to that shape.
- **The demo card reads as a moment in the studio.** The request is a Secondary bubble at
  85% width on the right, as in `chat.tsx`. Below it is "Draft 1" with Writing/Ready, then
  the streaming script, then the reply in plain Body text under a Hairline rule once the
  script is in. Every request and reply is rendered invisibly in one grid cell, as the
  scripts already were, so the card never changes height (measured: 881 px at 390 px wide
  through streaming, a chip switch and the finish).
- **The scripts stay short openings**, and the caption says so ("shortened to its
  opening"), since a request asks for 10 minutes and the card shows about 70 words.
- **"Hear it" names the beds**, from `AMBIENT_BEDS`: rain, ocean, forest, a soft drone,
  space, chanting, or none. "Bells, gongs and singing bowls" became "bells and bowls" to keep
  the step about as long as before.
- **Revising goes in "Keep it"**, the step after listening: "then come back and ask for a
  change: keep the earlier version or replace it." "On Discover" lost "for anyone to hear"
  to keep its length.
- **The row is house picks only when there are at least 3, else the newest; never a mix.**
  `pickLandingRow` in `src/lib/landing/featured.ts` is the pure rule. A row of one or two
  picks padded with newest would hide which is which. The subline says which one it is:
  "Picked from Discover." or "The newest on Discover."
- **Data reuse:** the newest come from Discover's own `discover_meditations` RPC with
  `toSearchArgs({}, 3)`. The picks are a direct `is_featured` read, as Discover's private
  `getFeaturedMeditations` does. That helper is server-action-bound and selects `*`, so it
  was not exported for this. Both reads are `anon`-safe in production: `anon` has `SELECT`
  on `meditations` behind RLS (`20261008000000`) and `EXECUTE` on `discover_meditations`
  (`20261022000036`). Neither migration was changed. A failed read counts as empty, and with
  nothing to show the page keeps the old link-to-Discover paragraph.
- **Layout:** three columns of covers from `sm` (inside 48rem, so the covers are about
  240 px); a stacked list with 72 px covers on a phone, so nothing scrolls sideways. Two
  `MeditationCover`s are rendered, one per breakpoint, because the cover's stroke weight and
  detail are chosen from its `size`.
- **Removed** `src/lib/landing/latest-meditation.ts` and `firstPassage` (with its test). The
  old card was their only user.
- **SEO description and pitch left alone.** Both are still true. The hero paragraph
  ("narrates it in a voice you choose, and sets its pauses, silences and bells into one
  audio file") is still true. It doesn't mention ambience, but the brief said to leave it
  unless false.
- `DESIGN.md`'s Landing Demo entry described the old "Focus" line, so it now describes the
  bubble, draft label and reply.

## Acceptance

- [x] No "focus" wording remains in the landing UI or its aria labels. The only "Focus" in
  the signed-out HTML is a seeded meditation's `focus` tag pill in the row, which is data.
- [x] The featured row falls back correctly, tested as a pure function
  (`src/lib/landing/featured.test.ts`, 5 tests).
- [x] Signed-out `curl` locally shows the row: "Hear one first", "Picked from Discover." and
  three `/meditation/dddd000…` links.
- [ ] Lighthouse mobile is not worse than task 22's 93. **It is 91, and `main` is also 91
  on the same machine today**, so this change costs nothing, but the bar is not met. See
  Outcome.
- [x] Dark, light and 390 px screenshots in the PR.
- [x] Lint, tsc, tests and build pass.

## Outcome

### What changed

- `src/lib/landing/examples.ts`: `focus` → `request` (a natural typed request with a length),
  plus `reply`. `examples.test.ts`: requests start with a capital, end without a full stop and
  name minutes; each reply repeats those minutes and ends on "…audio?"; all replies differ.
- `src/components/script-stream-demo.tsx`: request bubble, "Draft 1" label, reply line,
  `aria-label="Example requests"`, a new caption. Streaming, chips and reduced motion are
  unchanged in behaviour; under reduced motion the reply shows with the whole script.
- `src/app/page.tsx`: the "Hear it" and "Keep it" steps, and `HearOneFirst` (3 covers with
  `TagPills`, length, "More on Discover").
- `src/lib/landing/featured.ts` (+ test): `pickLandingRow`, `getLandingRow`.
- `DESIGN.md`: Landing Demo entry.

### Evidence

- `npm run lint`: 0 errors, 5 warnings, none in files this task touched (two are in the
  build-generated `src/app/.well-known/workflow/` files). `npx tsc --noEmit`
  is clean. `npm test`: 45 files, 426 tests pass. `npm run build` passes.
- Signed-out `curl http://localhost:3045/` against `next start`: "Hear one first",
  "Picked from Discover." and links to `dddd0001`, `dddd0004` and `dddd0007` (8 featured
  of 25 public, completed rows locally).
- Lighthouse 13.5.0, headless Chrome, mobile, signed out, against `next start` with local
  Supabase. Three runs each:
  - this branch: performance 91, 91, 91; accessibility 100, best practices 100, SEO 100;
    LCP 3.5 s, CLS 0, TBT 0–10 ms.
  - `main` (`1205844`), built and run the same way: performance 91, 91, 91; LCP 3.5 s, CLS 0.
  - The LCP element is the hero paragraph in both, as in task 22, held by the app-wide
    render-blocking CSS. The drop from 93 to 91 happened on `main` between task 22 and now,
    not in this task.
- Puppeteer (system Chrome), in this order:
  1. Dark at 1440 px: bubble, Draft 1 / Ready, script, reply, chips, caption; row of 3.
  2. Dark at 390 px: `scrollWidth` 390 = `clientWidth`; row `ul` 358 = 358; stacked list.
  3. Light at 390 px, then 1440 px.
  4. Mid-stream at 1.5 s: status "Writing", no reply visible. After tapping "A new baby":
     restarts, no reply. After 8 s: "Ready", its reply visible. Card height 881 px throughout.
  5. Reduced motion (dark, 390 px) at 0.5 s: whole script, "Ready", reply visible.
- `impeccable detect --json` over `page.tsx` and `script-stream-demo.tsx`: `[]`.

### For the operator

- **Lighthouse mobile is 91, not 93, on `main` as well as here.** Decide whether that blocks
  launch. If it does, it's a separate task on the shared CSS chunk, not on this page.
- Once you mark 3 or more house picks with `is_featured` in production, the row switches
  from "The newest on Discover." to "Picked from Discover." Fewer than 3 picks keeps the
  newest.
- Check `/` signed out in production after deploy: the row appears (the grants already exist
  there; no migration in this PR).
