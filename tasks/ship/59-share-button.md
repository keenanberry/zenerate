# Share a Meditation

**Status:** Done* (PR #119); the real-iPhone check in the installed app is the operator's (`tasks/OPERATOR-TODO.md` §5)
**Priority:** Phase 6. Public meditations and their share cards (23, 26) exist to be shared.
**Phase:** 6
**Depends on:** 55 (the "…" menu), 53 (Report, the pattern for a link built from the site URL).

## Why

The app installs on iPhone as a standalone web app (`display: "standalone"` in
`src/app/manifest.ts`, `appleWebApp` in `src/app/layout.tsx`). Standalone has no Safari
toolbar and no address bar, so there is no share sheet and no way to copy the URL. The
operator found on 2026-11-08 that the installed app cannot share at all.

## Scope

1. A Share item in the meditation page's "…" menu (`src/components/meditation-menu.tsx`),
   with the visitor items (Add to collection, Download), above Report.
2. Shown only while the meditation is public: a private link returns 404 to everyone but
   the owner. Visitors only ever see public meditations; the owner sees Share while
   `is_public` is true, following the Public/Private toggle without a reload.
3. `navigator.share` with the title, a short line and the canonical
   `<siteUrl>/meditation/<id>` when the browser has it (and `canShare` accepts the
   payload where present); a cancelled sheet is silent. Otherwise the URL goes on the
   clipboard and a "Link copied" toast confirms it.

## Not in scope

Sharing the home page or collections, a share icon outside the menu, share analytics, any
change to the Open Graph metadata.

## Done when

- [x] A signed-out visitor on a public meditation sees Share and Report, with a separator
      between them; a signed-in visitor sees Share, Add to collection, (Download), then Report.
      *`meditation-menu.test.tsx`; checked in the browser, dark and light, desktop and 390px.*
- [x] The owner sees Share while it is public and not while it is private, and the toggle
      changes it without a reload.
      *`meditation-menu.test.tsx` "follows the owner's toggle over the server's last word";
      in the browser, the owner's public and private seed meditations. The local seed has no
      audio objects, so the toggle itself was exercised by the test, not by hand.*
- [x] Share calls `navigator.share` with the title, a line and the canonical URL built from
      the site URL; `AbortError` is swallowed; without `navigator.share`, or when `canShare`
      refuses, the URL is copied and "Link copied" shows.
      *`share.test.ts`; in the browser with `navigator.share` stubbed (payload recorded) and
      removed (clipboard written, toast shown).*
- [ ] The native share sheet opens from the installed iPhone app with the title and link.
      *Operator, `tasks/OPERATOR-TODO.md` §5.*

## Outcome

PR #119.

- **`src/lib/meditation/share.ts`.** `sharePayload` builds `{ title, text, url }` from the
  meditation and the site URL (like `reportHref`, so a preview deploy or a stray query string
  still hands out the canonical page). `shareMeditation` returns `shared`, `cancelled`,
  `copied` or `failed`; a share sheet that fails for any reason but `AbortError` (a
  `NotAllowedError`, say) falls through to the clipboard so the person still gets the link.
- **Menu.** Share (lucide `Share`, matching Download's upward arrow) leads the visitor group.
  The page passes `isPublic` and `siteUrl`; the owner's optimistic toggle overrides
  `isPublic` once the audio exists. A failed copy shows "Couldn't share this link".
