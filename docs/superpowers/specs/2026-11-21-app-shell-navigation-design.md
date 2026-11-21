# App shell, Library and bottom sheets: design

**Date:** 2026-11-21
**Status:** Draft for approval
**Branch where it was brainstormed:** `keenanberry/feat/explore-new-ui-layout`

## Intent

Zenerate is used on a phone, often at the edges of the day, to do one of two things:
**listen** (to something of your own, something you favourited or bookmarked, or
something from Discover) or **create** (a new meditation in the studio). Making and
listening in the same app is what sets it apart from Spotify, Apple Music or Insight
Timer.

The shell does not serve that today on a phone:

- The top bar crams about six bare icons (Library, Create, Discover, theme, account,
  sign out) into 390px.
- The Library is three tabs (Meditations, Favorites, Collections) with a view toggle,
  while Bookmarks sit alone on `/account`, which also repeats your meditations and lists
  your chats.
- Menus and dialogs are desktop dropdowns and popovers with ~32px rows, hard to hit with
  a thumb.

The operator's references are the Spotify and Apple Music phone apps: tabs at the bottom,
a Library that is a list of places followed by recent items, and actions that rise from
the bottom of the screen.

## Goals

1. On a phone, the three jobs (Library, Discover, Create) are one thumb-tap away from any
   page, from a bottom tab bar.
2. The Library is a list of places (Favorites, Bookmarks, My meditations, Collections)
   followed by Recently played, so "open the app, find the thing, press play" is short.
3. Bookmarks join the Library; Account becomes profile and settings only.
4. Every menu and dialog on a phone is a bottom sheet with large rows that names what it
   acts on.

## Non-goals

- **Background playback / a persistent mini-player.** Meditations are not played while
  scrolling. Playback stays on the meditation page and in the session player. (Possible
  later idea, not this work.)
- **A desktop sidebar.** Desktop keeps a top bar.
- **Changing what favourites or bookmarks mean.** Settled 2026-11-20 in
  `tasks/post-ship/bookmarks.md`: favourites are "I liked this" and feed Popular;
  bookmarks are a private "later" queue. Both stay, unchanged.
- **Visual restyle.** Tokens, type and the Nocturne rhythm in `DESIGN.md` are unchanged
  except where this document says so.

## Anti-goals (would count as failure even if it works)

- The bottom bar covering the studio composer, the session player, or page content (the
  last row must scroll clear of the bar and the iPhone home indicator).
- Desktop getting worse: narrower content, a phone-shaped layout stretched wide, or
  menus that become sheets at desktop width.
- A grab handle on a sheet that does nothing when dragged.
- Drifting back toward stock shadcn density (see `DESIGN.md` Overview).

## Constraints

- Phone target is 390px, no horizontal scroll; the next step for the product is an
  installed PWA (`DESIGN.md` Layout).
- The `md` breakpoint (768px) is the switch for everything in this document: below it,
  phone layout (bottom bar, sheets); at and above it, desktop layout (top bar, dropdowns
  and centred dialogs).
- Dark is the design target; verify dark desktop, dark 390px, then light (the
  `zenerate-design` skill's order). Every new transition is under `motion-safe:`.
- Floating layers may keep their shadow; nothing in-flow gets one (`DESIGN.md` Elevation).
- No new UI dependency. The sheet is built on the existing Radix `Sheet`
  (`src/components/ui/sheet.tsx`, from the `radix-ui` package).
- The operator is the only user. **No redirects or compatibility for old URLs** are
  needed: `/dashboard` is renamed outright.

## Approaches considered

**The bottom sheet primitive** (the one real fork):

1. **Extend our own Radix `Sheet`.** *Chosen.* Radix already gives focus trap, Escape,
   scroll lock and screen-reader semantics, and the studio's canvas sheet already uses it.
   We add bottom styling, the safe-area inset and a small drag-to-close on the handle.
   No dependency; the drag is plain (no momentum, no snap points), which short action
   lists do not need.
2. **vaul (shadcn's Drawer).** The most native-feeling iOS swipe, but its README says
   "This repo is unmaintained" and its last release was December 2024. Rejected: any iOS
   Safari quirk after that would be ours to patch inside someone else's code.
3. **A bottom sheet with no swipe.** Rejected: a handle invites a drag, and one that
   does nothing reads as broken.

**Desktop navigation:**

1. **Keep the top bar.** *Chosen.* It is not crowded at desktop width, keeps the studio's
   two panes their full width, and leaves the landing and legal pages alone.
2. **A left sidebar holding the Library list** (Spotify/Apple Music desktop). Rejected:
   costs ~15rem on every page, squeezes the studio at laptop widths, and would need a
   separate shell for landing/legal. It pays off for people who hop between library lists
   all day, which is not this product.

**Library layout on a phone** (shown as mockups):

1. **List, then Recently played** (Apple Music). *Chosen by the operator.*
2. 2×2 tiles, then Recently played. Rejected: busier, more Spotify-like; the list still
   shows recent covers below the fold-line on a 390px screen.

## The design

### 1. Navigation

**Phone, signed in (below `md`):** a fixed bottom tab bar, a new component
(`src/components/bottom-bar.tsx` or similar) rendered by `src/app/(app)/layout.tsx`.

```
────────────────────────────────────
  ◫ Library    ◎ Discover    + Create
```

- Three tabs, in this order: **Library** (`/library`), **Discover** (`/discover`),
  **Create** (`/create`). Icon above a label; the active tab is `--foreground` with a
  `--primary` icon and `aria-current="page"`; inactive tabs are `--muted-foreground`.
- Height ~64px plus `env(safe-area-inset-bottom, 0px)`. *Builder's-check call:* the root
  layout stays without `viewport-fit=cover` (`src/app/layout.tsx` explains why: the
  `default` status bar keeps the page inside the safe area), so the inset is 0 today and
  the bar already sits above the home indicator; the `env()` term is there in case that
  ever changes. Do not change the viewport. The installed-app check goes to
  `tasks/OPERATOR-TODO.md`.
- Surface follows the theme: `--sidebar` (Deep Night in dark, pale lilac in light), at
  high opacity with backdrop blur, a Hairline top border, no shadow. *Builder's-check call:*
  not `--night`, which is dark in both themes because it belongs to the session player.
- Page content gets bottom padding equal to the bar's height plus the inset, so the last
  row and the footer scroll clear of it.
- **Hidden** in the studio (`/create/[chatId]`, already marked by `[data-studio]` on the
  shell) and while the full-screen session player is open.
- The top bar on a phone, signed in, shrinks to the wordmark only (it no longer carries
  section links, theme, account or sign out). Builder may drop it entirely on Library if
  the page title makes it redundant; keep the wordmark somewhere on Discover and the
  meditation page.

- *Builder's-check call:* the studio header gets a back link to Create on a phone, since
  the installed app has no browser back button and the bar is hidden there.

**Phone, signed out:** the top bar exactly as today (wordmark, Discover, theme toggle,
Sign in). No bottom bar.

**Landing page and `(legal)` layout:** *builder's-check call:* they keep today's top bar
at every width, signed in or out. The wordmark-only phone bar and the desktop
avatar/theme changes apply only inside the `(app)` shell, e.g. through a `variant` prop
on `Nav` passed by `src/app/(app)/layout.tsx`.

**Desktop (`md` and up):** the existing top bar in `src/components/nav.tsx`, with labels:
wordmark, Library, Create, Discover on the left; on the right, an **avatar** linking to
`/account`. The theme toggle and Sign out leave the bar and move into Account.

**Account entry on a phone:** an avatar button (initials from the profile's display name,
falling back to the email's first letter) at the top right of the Library page header,
linking to `/account`, as in Apple Music.

### 2. Library

`/dashboard` is renamed to **`/library`**. Update every reference: `nav.tsx`,
`manifest.ts` (`start_url`), the default `next` in `src/lib/supabase/middleware.ts` and
`src/app/(auth)/auth/callback/route.ts`, `src/lib/navigation/back-origin.ts`, the login
and reset-password pages, error/not-found pages, `robots.ts`, `api/meditations/[id]`,
`actions.ts` revalidations, and their tests (`grep -rn /dashboard src`). No redirect.

**`/library` (phone):**

```
Library                         (KB)
♥  Favorites                 12  ›
⌑  Bookmarks                  5  ›
✦  My meditations             8  ›
▤  Collections                3  ›
Recently played
[cover] [cover]
[cover] [cover]
```

- Title in the serif heading style; avatar at right.
- Four rows, each a link: icon in `--primary`, label, count in `--muted-foreground`,
  chevron. Rows at least 52px, Hairline dividers. Order: Favorites, Bookmarks,
  My meditations, Collections.
- **Recently played:** the caller's most recent distinct meditations from
  `meditation_plays` (already stored per listener with `played_at`, indexed on
  `(user_id, played_at desc)`, select-own under RLS), newest first, limited to what they
  can still see. Covers in a 2-column grid on a phone (more from `sm`), each with title
  and a meta line (duration · "yours" or "Discover"). Show up to 8.
- **Empty states:** rows always show (count 0). If nothing has been played, Recently
  played is replaced by one prompt to make a first meditation (button to `/create`) or
  browse Discover.

**`/library` (desktop):** same content inside the top-bar shell. The four rows sit in a
left column (~18rem) and Recently played fills the right as a cover grid. Below `md` it
stacks as above.

**Sub-pages:** `/library/favorites`, `/library/bookmarks`, `/library/meditations`,
`/library/collections`. Each has a back link to Library (the existing eyebrow-link
pattern), a title, and the content the old tab or Account section showed:

- Favorites and My meditations: `MeditationListView`, with the existing list/grid
  `ViewToggle`. My meditations keeps `showVisibility` and its empty state ("Create your
  first meditation").
- Bookmarks: the `AccountBookmarks` list and its pagination, moved from `/account`.
- Collections: the collection card grid.
- `data-back-label` on each so a meditation opened from it links back to that list
  (`src/components/back-origin.tsx`).

`DashboardTabs` is deleted.

### 3. Account

`/account` becomes: **Profile** (the existing form), **Appearance** (the theme toggle),
and **Sign out**. The Bookmarks section moves to `/library/bookmarks`. The
"My meditations & chats" section (`AccountCreations`) is removed: meditations are listed
and deleted from My meditations and each meditation's "…" menu; chats move to Create
(below).

### 4. Chats on Create

Create's "Recent" list (chats with no script yet, `listDraftChats`) gains a "…" per row
with **Delete** (the existing `DeleteDialog` flow and chat delete action that
`AccountCreations` uses today). Chats that already produced a meditation stay reachable
through the meditation's "Continue in chat".

*Call made in writing this up:* a chat that produced a meditation no longer has its own
Delete while the meditation exists (today it does, on `/account`). Nothing is stranded:
`chats.meditation_id` is `on delete set null`, so deleting the meditation turns its chat
back into a draft, which then appears in Create's Recent with its own Delete.

### 5. Bottom sheets

**The primitive.** Extend `src/components/ui/sheet.tsx` (or add a sibling) so
`side="bottom"`:

- rounded top corners, `--popover` surface, Hairline top border, full width, max height
  ~85dvh with internal scroll, padding-bottom includes `env(safe-area-inset-bottom)`;
- a grab handle at the top;
- **drag to close:** pointer drag on the handle (and the sheet header) moves the sheet
  down with the finger; releasing past ~one third of its height, or with a fast downward
  flick, closes it; otherwise it springs back. Under `prefers-reduced-motion` the sheet
  still drags but open/close/spring-back do not animate;
- tap outside and Escape close it (Radix already does).

The studio's canvas sheet adopts the same handle and drag for consistency.

**Two responsive wrappers**, each choosing at `md` with a media-query hook:

- `ResponsiveMenu` — `DropdownMenu` at `md`+, a bottom sheet of action rows below. Same
  item API for both so call sites write the items once. Sheet header names the item
  (cover thumbnail where there is one, title, a meta line).
- `ResponsiveDialog` — `Dialog` (or `Popover` where one is used today) at `md`+, a bottom
  sheet below.

A sheet's content mounts only when it opens, so the first render is the trigger alone
and there is no hydration mismatch or flash when the media query resolves.

Sheet rows are at least 52px, full width, icon at left in `--muted-foreground`,
destructive rows in `--destructive`.

**Sheets with text fields** (Edit collection, Add tag, a new collection inside Add to
collection): the focused field must stay visible above the iOS keyboard. Anchor these
sheets to the visual viewport, reusing the `--viewport-top` / `--viewport-height`
tracking the studio already does, rather than to the layout viewport. The on-device
check goes to `tasks/OPERATOR-TODO.md`.

**Converted surfaces** (every floating layer outside `components/ui/` today):

| Surface | File | Today | Below `md` |
|---|---|---|---|
| Meditation "…" | `meditation-menu.tsx` | DropdownMenu | Menu sheet |
| Collection card "…" (keeps its two-tap "Confirm delete") + the Edit collection form | `collection-card.tsx` | DropdownMenu + Dialog | Menu sheet + dialog sheet |
| Session player menu | `session-player.tsx` | DropdownMenu | Menu sheet |
| Add to collection | `add-to-collection-dialog.tsx` | Popover | Dialog sheet |
| Delete confirmation | `delete-dialog.tsx` | Dialog | Dialog sheet |
| Add tag | `meditation-details.tsx` (`AddTagPopover`) | Popover | Dialog sheet |
| Discover sort | `discover/search.tsx` | Select | Sheet of options with a check on the current one |
| Chat "…" on Create (new) | `create/page.tsx` | — | Menu sheet |

## Delivery

Three PRs, in order, each shippable on its own:

1. **Navigation.** Bottom bar, slimmer phone top bar, desktop avatar, Account trimmed to
   Profile/Appearance/Sign out, chat delete on Create, `/dashboard` → `/library` (the
   existing tabbed page simply moves), Bookmarks temporarily kept reachable (as a tab or
   a section) until PR 2.
2. **Library.** The list page, Recently played, the four sub-pages, `DashboardTabs`
   removed, Bookmarks moved in.
3. **Bottom sheets.** The primitive, the two wrappers, every surface in the table, the
   studio canvas handle.

Each PR follows the `zenerate-design` verification order and lists it in the PR body.
`DESIGN.md` is updated in each PR for what it changes (Layout: navigation paragraph and
the vertical rhythm table; Elevation: the sheet surface; the `/dashboard` mentions).
`PRODUCT.md`'s mention of the dashboard is updated in PR 2.

## Left to the builder

- Icon choices (lucide), exact copy of empty states and sheet headers.
- Whether the phone top bar on Library is removed or kept as wordmark-only.
- The media-query hook's implementation and the drag physics' exact numbers.
- Counts on the Library rows: one query or several, as long as the page is not slower
  than the current dashboard.
