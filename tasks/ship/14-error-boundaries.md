# Error + Not-Found Boundaries

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
No `error.tsx`, `not-found.tsx`, or `global-error.tsx` files exist. An uncaught exception in any server or client component renders Next.js's default dev-style error page, or a blank white screen in production. Bad paths 404 into the same undifferentiated failure. Users lose trust immediately.

## Acceptance criteria
- [ ] `src/app/not-found.tsx` — friendly 404 with a link back to the dashboard (or landing, depending on auth state)
- [ ] `src/app/error.tsx` — client error boundary with a "Try again" reset button, brief message, no stack trace in production
- [ ] `src/app/global-error.tsx` — fallback for errors in the root layout itself; includes its own `<html>`/`<body>` tags
- [ ] Route-group-level error boundaries where it makes sense (e.g. `src/app/(app)/error.tsx` so errors inside authed routes don't log the user out)
- [ ] Visual design matches the rest of the app (same nav if possible, same theme tokens)
- [ ] Errors that reach the boundary get logged somewhere — at minimum `console.error`, ideally a real error service (ties into post-ship `error-tracking.md`)

## Implementation notes
- `error.tsx` files are client components; they receive `{ error, reset }` props.
- `not-found.tsx` is a server component by default; can call `notFound()` from route segments to trigger it explicitly (e.g. when a meditation ID doesn't exist).
- For meditation/collection pages, check that the resource belongs to the user (or is public) and call `notFound()` when not — avoids RLS-flavored "no rows" rendering as a weird empty state.
- Keep the boundary copy warm and on-brand, not stiff ("Something unexpected happened. We've logged it. Try again?").

## Open questions
- Do we need per-route-group error pages, or is a single app-level one enough for v1? (Default: single + a custom one for the audio generation page which has its own failure UX.)
