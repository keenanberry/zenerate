# Toast Notifications

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
Actions across the app currently succeed or fail silently — saving a meditation, favoriting, adding to a collection, copying, network errors. Users have no confirmation anything happened, and errors disappear into the void. Sonner is already installed but unused.

## Acceptance criteria
- [ ] `<Toaster />` mounted in root layout (or app-level layout)
- [ ] Success toasts wired for: meditation saved, audio generation started, added to collection, removed from collection, collection created, favorited/unfavorited (optional — may feel noisy)
- [ ] Error toasts wired for: script generation failed, audio generation failed, network errors on server actions, quota exceeded (ties into task 03)
- [ ] "Copied to clipboard" toast where copy actions exist (script text copy from viewer)
- [ ] Toast style matches the amethyst-haze theme — verify in both light and dark modes
- [ ] No duplicate toasts on double-clicks (debounce or guard)

## Implementation notes
- Sonner: `import { toast } from 'sonner'` — `toast.success()`, `toast.error()`, `toast.promise()`.
- `toast.promise()` is especially nice for async actions: pass the promise, it handles loading/success/error states.
- For server-action results, return a discriminated union `{ok: true, data} | {ok: false, error}` and toast from the client side.
- Keep messages short and actionable. "Saved" > "Your meditation has been saved successfully." Error toasts should tell the user what to try next when possible.

## Open questions
- Favorite toasts: helpful feedback or noisy? (Default: skip — the heart fill is enough visual confirmation.)
