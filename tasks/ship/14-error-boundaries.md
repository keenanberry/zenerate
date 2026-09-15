# Error + Not-Found Boundaries

**Status:** Done
**Priority:** Ship-blocker

## Why this blocks ship
No `error.tsx`, `not-found.tsx`, or `global-error.tsx` files exist. An uncaught exception in any server or client component renders Next.js's default dev-style error page, or a blank white screen in production. Bad paths 404 into the same undifferentiated failure. Users lose trust immediately.

## Acceptance criteria
- [x] `src/app/not-found.tsx` — checks auth state and links to `/dashboard` when signed in, `/` when not. Sending a signed-out visitor to `/dashboard` would only bounce them through `(app)/layout`'s redirect to `/login`, reading as a second failure on top of the first
- [x] `src/app/error.tsx` — `{ error, reset }`, "Try again", no stack trace. **`error.message` is never rendered at all**, not merely hidden in production: Next redacts it in prod anyway, so showing it would print reassuring detail in dev and an opaque string to real users. `error.digest` is surfaced instead, since that is what correlates a user report with a server log
- [x] `src/app/global-error.tsx` — own `<html>`/`<body>`. It *replaces* the root layout, so it imports `globals.css` directly (otherwise no design tokens at all) and re-applies the `.dark` class inline before paint, because `ThemeProvider` is not running and a dark-mode user would otherwise be flashed a white page at the worst possible moment
- [x] `src/app/(app)/error.tsx` — renders inside `(app)/layout`, so the nav and chrome survive a page failure. **Correction to this criterion's original wording:** an error boundary never logs anyone out; the session cookie is untouched. Preserving the chrome is the actual benefit
- [x] Visual design matches — theme tokens throughout, nav preserved in both the authed 404 and the `(app)` error boundary (verified in-browser)
- [x] `console.error` in a `useEffect` in each boundary. Post-ship `error-tracking.md` replaces this

## Verification

| Case | Result |
|---|---|
| `/nonexistent-route`, signed out | **404** status, branded page, "Back to home" branch |
| `/meditation/<bogus-uuid>`, signed in | Branded 404 with nav preserved, "Back to your library" branch |
| Throwing route inside `(app)` | `(app)/error.tsx` rendered, "Try again" present, **nav preserved**, `digest` shown, probe's error message **not** leaked |

The 404 cases matter because `meditation/[id]:41` and `collections/[id]:36` were
*already* calling `notFound()` with no `not-found.tsx` to render — the plumbing existed
and was disconnected, so adding the file lit up two call sites for free.

One gotcha worth recording for future probes: a route directory whose name starts with
`_` is a Next.js **private folder** and is excluded from routing entirely. A throwaway
`__boom/page.tsx` silently 404s instead of throwing.

## Implementation notes
- `error.tsx` files are client components; they receive `{ error, reset }` props.
- `not-found.tsx` is a server component by default; can call `notFound()` from route segments to trigger it explicitly (e.g. when a meditation ID doesn't exist).
- For meditation/collection pages, check that the resource belongs to the user (or is public) and call `notFound()` when not — avoids RLS-flavored "no rows" rendering as a weird empty state.
- Keep the boundary copy warm and on-brand, not stiff ("Something unexpected happened. We've logged it. Try again?").

## Open questions
- ~~Do we need per-route-group error pages?~~ **Resolved:** root + `(app)`. The audio generation page was *not* given its own boundary — `generate-audio-panel` and `audio-section` already handle their failures inline with dedicated UX, so a boundary there would only catch render-time errors the `(app)` one already covers.
