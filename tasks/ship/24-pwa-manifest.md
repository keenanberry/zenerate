# PWA Manifest & Install

**Status:** Not started
**Priority:** Ship-blocker for the stated goal — "I want this on my iPhone as an app"
**Depends on:** 23 (icons), 09 (HTTPS domain — install requires a secure origin)

## Why this blocks ship

Making the app installable is roughly an hour of work and no service worker. Doing it at
launch costs nothing and doesn't commit the project to native mobile, which is explicitly
out of scope.

Deliberately **not** in this task: offline access and push notifications. Both need a
service worker, both are real features rather than configuration, and both belong
post-ship. Web push on iOS additionally requires the PWA to already be installed — so
this task is the prerequisite for that later work, which is another reason to do it now.

## Acceptance criteria

- [ ] `src/app/manifest.ts` exporting a Next.js `MetadataRoute.Manifest`
- [ ] `name: "Zenerate"`, a `short_name` that fits under a home-screen icon without truncating
- [ ] `display: "standalone"` so it opens without browser chrome
- [ ] `start_url: "/dashboard"` — an installed app should open to the library, not the marketing page
- [ ] `theme_color` and `background_color` matching the Nocturne dark ground
- [ ] Icons wired from task 23, including the maskable variant
- [ ] `appleWebApp` metadata set in `layout.tsx` (`capable`, `statusBarStyle`, `title`) — iOS reads these, not the manifest
- [ ] Installed on a real iPhone via Safari → Share → Add to Home Screen, and verified: correct icon, correct name, opens chrome-less, status bar legible against the dark ground
- [ ] Login verified **inside the installed app** — iOS standalone PWAs use a separate storage jar from Safari, so the session does not carry over and the first launch requires signing in again
- [ ] Safe-area insets respected so content doesn't sit under the notch or home indicator
- [ ] Verified the app still works normally as a browser tab

## Implementation notes

- Next 16 generates the manifest link tag automatically from `app/manifest.ts` — no manual `<link rel="manifest">`.
- `theme_color` sets the iOS status bar background in standalone mode. With `statusBarStyle: "black-translucent"` the content extends behind the status bar, which needs `viewport-fit=cover` plus `env(safe-area-inset-*)` padding. `"default"` is simpler and fine.
- The separate-storage-jar behaviour surprises people: the user installs the app, opens it, and appears logged out. That's expected, not a bug — but it's worth knowing before debugging it.
- Do not add a service worker in this task. A half-configured service worker caching stale assets is materially worse than none, and it's hard to un-ship from installed clients.

## Open questions

- Custom install prompt on Android (`beforeinstallprompt`), or rely on the browser's own? Rely on the browser for v1 — the primary user is on iOS, where that event doesn't exist anyway.
