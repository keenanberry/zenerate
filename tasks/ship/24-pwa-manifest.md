# PWA Manifest & Install

**Status:** Done. The operator installed it on an iPhone and played a meditation inside the installed app, 2026-10-10
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

- [x] `src/app/manifest.ts` exporting a Next.js `MetadataRoute.Manifest`
- [x] `name: "Zenerate"`, a `short_name` that fits under a home-screen icon without truncating
- [x] `display: "standalone"` so it opens without browser chrome
- [x] `start_url: "/dashboard"` — an installed app should open to the library, not the marketing page
- [x] `theme_color` and `background_color` matching the Nocturne dark ground
- [x] Icons wired from task 23, including the maskable variant
- [x] `appleWebApp` metadata set in `layout.tsx` (`capable`, `statusBarStyle`, `title`) — iOS reads these, not the manifest
- [x] Installed on a real iPhone via Safari → Share → Add to Home Screen, and verified: correct icon, correct name, opens chrome-less, status bar legible against the dark ground (operator, confirmed 2026-10-10)
- [x] Login verified **inside the installed app** — iOS standalone PWAs use a separate storage jar from Safari, so the session does not carry over and the first launch requires signing in again (operator, confirmed 2026-10-10)
- [x] Safe-area insets respected so content doesn't sit under the notch or home indicator — by construction: the `default` status bar and no `viewport-fit=cover` keep the page inside the safe area; the on-device look is in the operator's list
- [x] Verified the app still works normally as a browser tab

## Implementation notes

- Next 16 generates the manifest link tag automatically from `app/manifest.ts` — no manual `<link rel="manifest">`.
- `theme_color` sets the iOS status bar background in standalone mode. With `statusBarStyle: "black-translucent"` the content extends behind the status bar, which needs `viewport-fit=cover` plus `env(safe-area-inset-*)` padding. `"default"` is simpler and fine.
- The separate-storage-jar behaviour surprises people: the user installs the app, opens it, and appears logged out. That's expected, not a bug — but it's worth knowing before debugging it.
- Do not add a service worker in this task. A half-configured service worker caching stale assets is materially worse than none, and it's hard to un-ship from installed clients.

## Open questions

- Custom install prompt on Android (`beforeinstallprompt`), or rely on the browser's own? Rely on the browser for v1 — the primary user is on iOS, where that event doesn't exist anyway.

## Outcome (2026-10-09)

**What shipped**

- `src/app/manifest.ts`, served at `/manifest.webmanifest` (Next adds the
  `<link rel="manifest">`): name and short name `Zenerate` (8 characters), the locked
  pitch from `PRODUCT.md` as the description, `start_url: /dashboard`, `scope: /`,
  `display: standalone`, theme and background `#1a1823`, and `icon-192`, `icon-512` and
  `icon-maskable-512` (purpose `maskable`).
- `src/app/layout.tsx`, in a block marked `--- Install (task 24)` so task 26 can extend the
  same `metadata` around it: `appleWebApp` (`capable`, `statusBarStyle: "default"`,
  `title: "Zenerate"`), `icons.apple` pointing at `/apple-touch-icon.png`, and a new
  `viewport` export with one `theme-color` per colour scheme.
- `src/lib/brand/ground.ts`: Midnight `#1a1823` and Paper `#f6f3fe` as hex. Tests pin them
  to DESIGN.md's frontmatter through the icon build's own `oklchToHex`, and check the
  manifest's fields and that every icon it lists exists in `public/` at its declared size.

**Decisions**

- *`statusBarStyle: "default"`, not `"black-translucent"`.* Translucent draws white status
  text over the page, and the page is Paper in the light theme, so the clock would vanish
  for anyone on a light system. `default` gives an opaque bar and keeps the page inside
  the safe area, so `viewport-fit=cover` and `env(safe-area-inset-*)` padding are not
  needed: with `viewport-fit` at its default, the insets are 0 and iOS fills them with the
  page ground.
- *Hex, not `oklch()`.* Manifest parsers and iOS do not reliably read `oklch()`. The values
  come from the same converter task 23 used for the icon grounds, so the install splash
  (`background_color`) is the same Midnight as the icon tile.
- *Theme colour per colour scheme.* The manifest has one `theme_color` (Midnight; dark is
  the target). The `theme-color` meta follows `prefers-color-scheme`, Midnight or Paper,
  matching the page under the default `system` theme. A theme forced with the toggle is
  not reflected in the browser tint; doing that needs a client component rewriting the
  meta, which is more than this task.
- *`icons.apple` in metadata.* iOS also probes `/apple-touch-icon.png` by convention, but
  the explicit link is the documented path. The file-based `favicon.ico` link still renders.
- *No service worker, no install prompt.* As scoped. Chrome no longer requires a service
  worker for installability, and Lighthouse's installability audit passes without one.

**Evidence**

- `npm run lint` (0 errors; 3 warnings, all in untouched files), `npx tsc --noEmit`,
  `npm test` (25 files, 232 tests) and `npm run build` pass. The build lists
  `/manifest.webmanifest` as static.
- Production build on :3124: `/manifest.webmanifest` returns 200,
  `application/manifest+json`, with the fields above. The rendered `<head>` carries the
  manifest link, `mobile-web-app-capable`, `apple-mobile-web-app-title`,
  `apple-mobile-web-app-status-bar-style`, the apple-touch-icon link and both
  `theme-color` metas. Signed out, `/dashboard` redirects to `/login`, so a fresh install
  lands on sign-in.
- Lighthouse 11.7.1 (the last version with the PWA category, which runs the same
  installability check as DevTools' Application panel), headless Chrome: PWA category 1.0;
  `installable-manifest`, `maskable-icon`, `splash-screen`, `themed-omnibox`, `viewport`
  and `content-width` all pass with no installability errors.
- Chrome, in order: dark desktop (`/`, `/dashboard`), dark at 390px (both pages in 390px
  iframes, no horizontal scroll), light at both widths, all as an ordinary browser tab.
  The maskable icon under the 80% minimum safe-zone circle, a full circle and a squircle:
  the leaf is whole in all three. No console errors.
- `impeccable detect` on the changed files: no findings.

**Found along the way**

- Next 16 emits `mobile-web-app-capable`, not the older `apple-mobile-web-app-capable`,
  for `appleWebApp.capable`. iOS has launched home-screen apps standalone from the
  manifest's `display` since 11.3, so the manifest is what makes it chrome-less; if a
  device opens it in Safari instead, this is the first place to look.
- The Claude-in-Chrome extension cannot open DevTools, so the Application panel itself was
  not opened; the Lighthouse run above is the same check. Worth a glance by the operator.
