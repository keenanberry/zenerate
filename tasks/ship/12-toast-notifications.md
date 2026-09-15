# Toast Notifications

**Status:** Done
**Priority:** Ship-blocker

## Why this blocks ship
Actions across the app currently succeed or fail silently — saving a meditation, favoriting, adding to a collection, network errors. Users have no confirmation anything happened, and errors disappear into the void. Sonner is already installed but unused.

## Acceptance criteria
- [x] `<Toaster />` mounted in root layout (or app-level layout)
- [x] Success toasts wired for: meditation saved, audio generation started, added to collection, removed from collection, collection created, favorited/unfavorited (optional — may feel noisy)
- [x] Error toasts wired for: network errors on server actions — saving a meditation, add/remove/create collection, favorite, visibility. **Script generation, audio generation and quota exceeded are surfaced inline, not toasted** (`meditation-form.tsx` `onError`, `generate-audio-panel.tsx` and `audio-section.tsx` error state) — these already render the failure in place, including the 429/503 quota copy from task 03, so a toast would report one failure twice
- [x] ~~"Copied to clipboard" toast where copy actions exist~~ — **N/A, dropped 2026-09-15.** No copy action exists anywhere in the app; `script-viewer.tsx` has no copy button. The criterion was written speculatively in the bulk task-authoring commit (`4f9ad43`) and its own conditional phrasing ("where copy actions exist") assumed a surface that was never built. `script-editor.tsx` already renders the script as selectable text, so select-and-copy works today. If script export is wanted, it belongs with task 13's download work, not here
- [x] Toast style matches the amethyst-haze theme — **verified in both modes** against the live app. `ui/sonner.tsx` binds sonner's `--normal-bg`/`--normal-text`/`--normal-border`/`--border-radius` to the theme tokens, and the toast's *computed* styles match them exactly in each theme: dark `bg lab(13.1614 4.75711 -10.1539)` = `--popover`, `border lab(19.1122 …)` = `--border`; light `bg lab(100 0 0)` = `--popover`, `color lab(26.0193 …)` = `--popover-foreground`; `border-radius: 8px` = `--radius` (.5rem) in both
- [x] No duplicate toasts on double-clicks (debounce or guard)

## Verification

Success, error and rollback paths were exercised against the running app (not just
reasoned about):

| Case | Result |
|---|---|
| Add to collection (dark) | `Added to Wind Down`, `data-type="success"`, tokens match |
| Remove from collection (light) | `Removed from Wind Down`, tokens match |
| Failed add (`fetch` stubbed to reject) | `Couldn't add to Wind Down`, `data-type="error"`, **and the optimistic count rolled back 2 → 3 → 2** |

Note that sonner renders its container lazily — `[data-sonner-toaster]` is absent from the
DOM until a toast is live, so "the Toaster isn't mounted" is the expected reading of an
idle page and not evidence of a problem.

## Resolved during implementation

**Server actions were left throwing; they do not return a discriminated union.** The
implementation note below suggested that refactor. It was rejected for two reasons.
First, **Next.js redacts server-action error messages in production** — a thrown error
reaches the client as a generic message plus a digest, so toasting `err.message` would
have looked correct in dev and silently degraded to opaque text in prod. Second, the one
flow that genuinely needs specific error text is quota exhaustion, and that already
travels over the JSON API routes (`/api/audio/generate` returns `{ error }`, read by
`generate-audio-panel.tsx` and `audio-section.tsx`). Each client call site now owns its
own written message instead, which is immune to redaction and reads better than a
database error anyway.

**Components with inline error UI were deliberately left alone.**
`generate-audio-panel.tsx`, `voice-picker.tsx` and `audio-section.tsx` already render
their failures in place; adding toasts would report one failure twice.
`generate-audio-panel.tsx` gained a *success* toast only.

**Favorites toast on failure but not on success**, resolving the open question below.
The filled heart is sufficient confirmation, but a silent rollback is indistinguishable
from a UI glitch, so the error case needs a toast.

## Implementation notes
- Sonner: `import { toast } from 'sonner'` — `toast.success()`, `toast.error()`, `toast.promise()`.
- `toast.promise()` is especially nice for async actions: pass the promise, it handles loading/success/error states.
- For server-action results, return a discriminated union `{ok: true, data} | {ok: false, error}` and toast from the client side.
- Keep messages short and actionable. "Saved" > "Your meditation has been saved successfully." Error toasts should tell the user what to try next when possible.

## Open questions
- ~~Favorite toasts: helpful feedback or noisy?~~ **Resolved:** success silent, failure toasted. See above.
