# App Shell, Library and Bottom Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first shell: a bottom tab bar (Library · Discover · Create), a Library that is a list of places plus Recently played, a slimmed Account, and bottom sheets for every menu and dialog below 768px.

**Architecture:** Three PRs, each shippable alone, each branched from `main` after the previous one merges. PR 1 changes navigation and moves pages; PR 2 builds the Library list and its sub-pages; PR 3 adds a drag-to-close bottom sheet on the existing Radix `Sheet` plus responsive wrappers that pick dropdown/dialog at `md`+ and a sheet below, and converts every floating layer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui on `radix-ui`, Supabase, Vitest (node environment; components are tested with `renderToStaticMarkup`, see `src/components/meditation-menu.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-11-21-app-shell-navigation-design.md` — read it in full before starting any PR. It holds the copy, the layout sketches and the reasons; this plan holds the file-level decisions.

## Global Constraints

- The switch for everything is `md` (768px): below it, bottom bar and sheets; at and above it, top bar, dropdowns, dialogs, popovers as today.
- No new UI dependency. No `vaul`.
- No redirect from `/dashboard`; it is renamed to `/library` outright.
- Do not add `viewport-fit=cover` or change `viewport` in `src/app/layout.tsx`.
- Bottom bar: z-index `z-40` (the session player overlay is `z-50` and covers it; sheets are `z-50`), surface `bg-sidebar/95 backdrop-blur`, Hairline `border-t`, no shadow, height 64px + `env(safe-area-inset-bottom, 0px)`.
- Rows in the Library list and in sheets are at least 52px tall.
- Colour only from tokens (`zenerate-design` skill, The Token Rule). No new `shadow-*` in page flow. Every transition under `motion-safe:`.
- Before opening each PR, follow the `zenerate-design` skill's "Verify, in this order" (dark desktop, dark 390px via DevTools emulation, light both, every surface touched, reduced motion, one `impeccable detect` run) and list what was checked in the PR body.
- CI runs `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`; all four must pass locally before pushing. `~/.npmrc` skips peer deps, so no lockfile changes are expected; if `package-lock.json` changes, revert it.
- Device-only checks go to `tasks/OPERATOR-TODO.md` in the PR that creates them.

## Review Focus

1. **Content under the bar.** On a 390px screen the last row of a long list and the site footer must scroll fully clear of the bottom bar. Pinned in Task 1.2 by a markup test that `main` carries the bar-height bottom padding only when the bar renders.
2. **The studio.** On `/create/[chatId]` the bar must not render (the composer is pinned to the bottom) and there must be a way back to Create. Pinned in Task 1.1 (`showBottomBar`) and Task 1.5.
3. **One layer opening another.** "Add to collection" from the meditation "…" sheet must close the menu sheet and then open the collection sheet, not open-and-instantly-close (the dropdown already needs the `collectionsNext` + `onCloseAutoFocus` trick in `meditation-menu.tsx`). Pinned in Task 3.3 by keeping `onCloseAutoFocus` on `ResponsiveMenuContent` in both modes and a test that it is forwarded.
4. **The session player is always dark.** A sheet portals to `<body>`, outside the player's `.dark` scope, so in the light theme its menu sheet would render light. Pinned in Task 3.4: the session player passes `className="dark"` to its sheet content, with a markup assertion.
5. **Recently played visibility.** A meditation played earlier that has since gone private (someone else's) or been deleted must not appear, and one played five times appears once. Pinned in Task 2.1 by `latestDistinct` tests and by the query only returning rows the caller can still read.

---

## PR 1 — Navigation

Branch: `feat/app-shell-nav` from `main`.

### Task 1.1: Tab model

**Files:**
- Create: `src/lib/navigation/app-tabs.ts`
- Test: `src/lib/navigation/app-tabs.test.ts`

**Interfaces:**
- Produces:
  - `type AppTab = "library" | "discover" | "create"`
  - `const APP_TABS: readonly { id: AppTab; href: string; label: string }[]` — in order `library` `/library` "Library", `discover` `/discover` "Discover", `create` `/create` "Create" (icons are chosen in the component, not here).
  - `activeTab(pathname: string): AppTab | null`
  - `showBottomBar(pathname: string): boolean`
  - `initials(displayName: string | null, email: string | null): string`

- [ ] **Step 1: Write the failing tests**

```ts
expect(activeTab("/library")).toBe("library");
expect(activeTab("/library/favorites")).toBe("library");
expect(activeTab("/collections/abc")).toBe("library");
expect(activeTab("/discover")).toBe("discover");
expect(activeTab("/create")).toBe("create");
expect(activeTab("/account")).toBeNull();
expect(activeTab("/meditation/abc")).toBeNull();
expect(showBottomBar("/create")).toBe(true);
expect(showBottomBar("/create/0b6c…")).toBe(false); // the studio
expect(showBottomBar("/library")).toBe(true);
expect(initials("Keenan Berry", "k@x.com")).toBe("KB");
expect(initials("  ada  ", null)).toBe("A");
expect(initials(null, "zed@x.com")).toBe("Z");
expect(initials(null, null)).toBe("?");
```

- [ ] **Step 2: Run `npx vitest run src/lib/navigation/app-tabs.test.ts`** — expect FAIL (module missing).
- [ ] **Step 3: Implement** in `app-tabs.ts`. `initials`: first letter of the first and last whitespace-separated words of the trimmed display name, uppercased, max 2; else the email's first letter; else `"?"`.
- [ ] **Step 4: Run the test** — expect PASS.
- [ ] **Step 5: Commit** `Add the app tab model for the bottom bar`.

### Task 1.2: Bottom bar, app-shell top bar, desktop avatar

**Files:**
- Create: `src/components/bottom-bar.tsx`, `src/components/bottom-bar.test.tsx`, `src/components/sign-out-button.tsx`
- Modify: `src/components/nav.tsx`, `src/app/(app)/layout.tsx`
- Leave alone: `src/app/page.tsx` and `src/app/(legal)/layout.tsx` (they keep today's bar via the default variant).

**Interfaces:**
- Consumes: Task 1.1.
- Produces:
  - `BottomBar(): JSX.Element | null` — client component, reads `usePathname()`, returns null when `!showBottomBar(pathname)`. Renders `<nav aria-label="Primary">` with one link per `APP_TABS`, `aria-current="page"` on the active one. `md:hidden fixed inset-x-0 bottom-0 z-40`.
  - `Nav({ isSignedIn, variant = "site", avatar }: { isSignedIn: boolean; variant?: "site" | "app"; avatar?: { initials: string } | null })`. `"site"` renders exactly today's bar. `"app"` signed in: below `md`, wordmark only; at `md`+, wordmark, Library/Create/Discover with labels, and on the right an avatar link to `/account` (`aria-label="Account"`, initials in a round `bg-card` chip) — no theme toggle, no sign out. `"app"` signed out: same as `"site"`.
  - `AccountAvatarLink({ initials, className }: { initials: string; className?: string })` in `src/components/account-avatar-link.tsx` — the round initials chip linking to `/account` with `aria-label="Account"` and `aria-current` on `/account`. Used by `Nav` (desktop) and the Library header (phone, Task 1.3 and Task 2.2).
  - `SignOutButton({ className }: { className?: string })` — the current `handleSignOut` logic moved out of `nav.tsx` (signOut, `resetBookmarkOverrides()`, push `/`, refresh). `nav.tsx`'s `"site"` variant uses it.
  - `src/app/(app)/layout.tsx`: when signed in, also reads `user_profiles.display_name` for the avatar; renders `<Nav variant="app" …/>`, `<BottomBar />` when signed in, and adds `pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0` to the shell wrapper (not `main`, so the footer clears too) only when signed in. The studio already pins the shell with `has-[[data-studio]]`; make sure the padding does not apply there (`has-[[data-studio]]:pb-0`).

- [ ] **Step 1: Write the failing test** `bottom-bar.test.tsx` (mock `next/navigation`'s `usePathname`):
  - on `/library/favorites`, markup has three links in order Library, Discover, Create, and `aria-current="page"` only on Library;
  - on `/create/abc`, markup is `""`.
- [ ] **Step 2: Run it** — expect FAIL.
- [ ] **Step 3: Implement** `BottomBar`, `SignOutButton`, the `Nav` variant, and the layout changes above. Tab: icon above label, `text-[11px]` label, active `text-foreground` with `text-primary` icon, inactive `text-muted-foreground`; each tab a 44px+ hit area.
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `Add the bottom tab bar and the app-shell top bar`.

### Task 1.3: Rename `/dashboard` to `/library`

**Files:**
- Move: `src/app/(app)/(authed)/dashboard/page.tsx` → `src/app/(app)/(authed)/library/page.tsx` (contents unchanged in this PR except `router.replace` paths)
- Modify: every hit of `grep -rn "/dashboard" src` — `nav.tsx`, `dashboard-tabs.tsx` (its `router.replace` path), `manifest.ts` (`start_url: "/library"`) and `manifest.test.ts`, `lib/supabase/middleware.ts` + test, `app/(auth)/auth/callback/route.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/reset-password/reset-password-form.tsx`, `lib/auth/redirect.test.ts`, `lib/auth/errors.test.ts`, `lib/navigation/back-origin.ts` + test, `app/error.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`, `robots.ts`, `app/api/meditations/[id]/route.ts`, `collections/[id]/page.tsx`, `meditation-menu.tsx`, `lib/meditation/actions.ts` (`revalidatePath`). Also `CLAUDE.md`'s "Where Things Live" row and `DESIGN.md` mentions.

- [ ] **Step 1: Update the tests first** (`manifest.test.ts`, `middleware.test.ts`, `redirect.test.ts`, `errors.test.ts`, `back-origin.test.ts`) to expect `/library`. Run `npm test` — expect those to FAIL.
- [ ] **Step 2: Move the route and update every source reference.** In the moved page's header, add `AccountAvatarLink` with `md:hidden` (the page reads `user_profiles.display_name` and the user's email for `initials`), so a phone user can reach Account in this PR, before PR 2 rebuilds the page.
- [ ] **Step 3: Verify** `grep -rn "dashboard" src` returns only `DashboardTabs` identifiers (removed in PR 2), and `npm test` passes.
- [ ] **Step 4: Commit** `Rename /dashboard to /library`.

### Task 1.4: Account becomes Profile, Appearance, Sign out

**Files:**
- Modify: `src/app/(app)/(authed)/account/page.tsx`
- Delete: `src/components/account-creations.tsx`, `src/components/account-creations.test.tsx`

**Interfaces:**
- Consumes: `SignOutButton` (Task 1.2), `ThemeToggle` (or a labelled theme control the builder chooses; it must carry a visible label "Theme" or "Dark theme").

- [ ] **Step 1:** Remove the "My meditations & chats" section and the meditations/chats queries. Keep the Bookmarks section exactly as it is (it moves in PR 2). Add an **Appearance** section (theme control) and a **Sign out** section/button at the end. Update the page's doc comment and description line ("Your profile and settings.").
- [ ] **Step 2:** Delete `AccountCreations` and its test; confirm nothing else imports it (`grep -rn AccountCreations src`).
- [ ] **Step 3:** `npm test && npx tsc --noEmit` — PASS.
- [ ] **Step 4: Commit** `Trim Account to profile, appearance and sign out`.

### Task 1.5: Chats on Create, and the way out of the studio

**Files:**
- Create: `src/components/studio/draft-chat-list.tsx`, `src/components/studio/draft-chat-list.test.tsx`
- Modify: `src/app/(app)/(authed)/create/page.tsx`, `src/components/studio/studio.tsx`

**Interfaces:**
- Produces: `DraftChatList({ chats }: { chats: Pick<Chat, "id" | "title" | "updated_at">[] })` — client component rendering today's ruled "Recent" list; each row keeps its link and gains a "…" (`DropdownMenu` for now, converted in Task 3.4) with one item, **Delete**, which opens `DeleteDialog` with `{ kind: "chat", id, title }`. On `onDeleted`, the row leaves the list and `toast.success("Chat deleted")`, as `AccountCreations` did.

- [ ] **Step 1: Write the failing test** (mock `@/components/ui/dropdown-menu` the way `meditation-menu.test.tsx` does): two chats render two links to `/create/<id>` and two buttons labelled `More for <title>`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** and use it in `create/page.tsx`.
- [ ] **Step 4:** In `studio.tsx`, add a back link to `/create` ("New meditation" or a back chevron with `aria-label="Back to Create"`), visible below `md` only (`md:hidden`), in the studio's top area.
- [ ] **Step 5:** `npm test` — PASS. **Commit** `Move chat deletion to Create and add a way out of the studio`.

### Task 1.6: Docs and PR

- [ ] Update `DESIGN.md` Layout: the navigation paragraph (bottom bar below `md`, app-shell top bar, desktop avatar, landing/legal unchanged) and add "Bottom bar | 64px + safe-area inset" to the rhythm table.
- [ ] Add to `tasks/OPERATOR-TODO.md`: "Installed app on iPhone: bottom bar sits above the home indicator; last list row scrolls clear of it; studio back link works."
- [ ] Run lint, tsc, test, build. Verify per the Global Constraints. Open the PR.

---

## PR 2 — Library

Branch: `feat/library-list` from `main` after PR 1 merges.

### Task 2.1: Recently played and the Library counts

**Files:**
- Create: `src/lib/meditation/library.ts`, `src/lib/meditation/library.test.ts`
- Modify: `src/lib/meditation/actions.ts` (export the two server reads, or put them in `library.ts` with `"use server"` semantics matching `actions.ts`)

**Interfaces:**
- Produces:
  - `latestDistinct(plays: { meditation_id: string; played_at: string }[], limit: number): string[]` — pure; input newest-first; returns meditation ids, first occurrence wins, at most `limit`.
  - `getRecentlyPlayed(limit = 8): Promise<RecentlyPlayed[]>` where `type RecentlyPlayed = MeditationWithMeta & { source: "yours" | "discover" }`. Reads the caller's `meditation_plays` newest first (fetch `limit * 5` rows to survive repeats), `latestDistinct`, then reads those meditations with the **user's** client (RLS drops anything no longer visible) filtered to `status = 'completed'`, re-sorted to play order, `source` = `"yours"` when `user_id` is the caller. Hydrate covers/audio the way `getFavoriteMeditations` does. Signed out → `[]`.
  - `getLibraryCounts(): Promise<{ favorites: number; bookmarks: number; meditations: number; collections: number }>` — `count: "exact", head: true` queries in parallel. `bookmarks` must count with the same visibility rule `listBookmarks` applies (read `src/lib/meditation/bookmarks.ts`), so the row's number matches the list.

- [ ] **Step 1: Write the failing tests** for `latestDistinct`:

```ts
const p = (id: string, t: string) => ({ meditation_id: id, played_at: t });
expect(latestDistinct([p("a","3"),p("b","2"),p("a","1")], 8)).toEqual(["a","b"]);
expect(latestDistinct([p("a","3"),p("b","2"),p("c","1")], 2)).toEqual(["a","b"]);
expect(latestDistinct([], 8)).toEqual([]);
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** all three. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `Add Recently played and the Library counts`.

### Task 2.2: The Library list page

**Files:**
- Modify: `src/app/(app)/(authed)/library/page.tsx` (replace the tabbed page)
- Create: `src/components/library/library-rows.tsx`, `src/components/library/recently-played.tsx`, `src/components/library/library-rows.test.tsx`

**Interfaces:**
- Consumes: Task 2.1; `initials` (Task 1.1).
- Produces:
  - `LibraryRows({ counts }: { counts: Awaited<ReturnType<typeof getLibraryCounts>> })` — four links in order Favorites `/library/favorites`, Bookmarks `/library/bookmarks`, My meditations `/library/meditations`, Collections `/library/collections`; icon (`text-primary`), label, count (`text-muted-foreground tabular-nums`), chevron; `min-h-13` rows with Hairline dividers.
  - `RecentlyPlayed({ items }: { items: RecentlyPlayed[] })` — heading "Recently played"; cover grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` reusing the existing cover component (`meditation-cover.tsx`); meta line `<duration> · Yours|Discover`. When `items` is empty, renders the first-meditation prompt: one sentence, a primary button to `/create`, an outline button to `/discover`.
- Page: header with serif "Library" title and the avatar link to `/account` (phone only, `md:hidden`; desktop has it in the top bar). Below `md` rows then Recently played stacked; at `md`+ `grid md:grid-cols-[18rem_1fr] gap-10`. `data-back-label="Library"` on the root.

- [ ] **Step 1: Write the failing test**: `LibraryRows` with counts `{favorites: 12, bookmarks: 0, meditations: 8, collections: 3}` renders four hrefs in the order above and the text `0` for Bookmarks.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** the components and page. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `Make the Library a list of places with Recently played`.

### Task 2.3: The four sub-pages; Bookmarks leave Account

**Files:**
- Create: `src/app/(app)/(authed)/library/{favorites,bookmarks,meditations,collections}/page.tsx`, `src/components/library/library-subpage.tsx`
- Modify: `src/app/(app)/(authed)/account/page.tsx` (remove the Bookmarks section and its query), `src/components/account-bookmarks.tsx` (keep the component; rename only if you also rename its test — optional)
- Delete: `src/components/dashboard-tabs.tsx`

**Interfaces:**
- Produces: `LibrarySubpage({ title, backLabel, children, toolbar }: { title: string; backLabel: string; children: ReactNode; toolbar?: ReactNode })` — eyebrow back link to `/library` ("Library", using the existing `parent-link.tsx` pattern), serif title, optional right-aligned toolbar, content at `mt-8`. Root carries `data-back-label={backLabel}` so a meditation opened here links back here.
- Content per page, moved from the old tabs/Account with their empty states: Favorites and My meditations — `MeditationListView` inside `ViewProvider` with `ViewToggle` as the toolbar (My meditations keeps `showVisibility`); Bookmarks — `AccountBookmarks` with the first page from `listBookmarks(…, { limit: ACCOUNT_BOOKMARK_PAGE })` and its error fallback; Collections — the collection card grid.

- [ ] **Step 1:** Build `LibrarySubpage` and the four pages. **Step 2:** Remove Bookmarks from Account; delete `DashboardTabs`. **Step 3:** `grep -rn "dashboard\|DashboardTabs" src` returns nothing. **Step 4:** `npm test && npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `Add the Library sub-pages and move Bookmarks into the Library`.

### Task 2.4: Docs and PR

- [ ] `DESIGN.md` Layout: `/library` and its sub-pages replace the `/dashboard` lines (widths: list page and sub-pages use the full 64rem). `PRODUCT.md`: dashboard mention → Library. `tasks/post-ship/bookmarks.md` status line: the list now lives at `/library/bookmarks`.
- [ ] Lint, tsc, test, build; verify; open the PR.

---

## PR 3 — Bottom sheets

Branch: `feat/bottom-sheets` from `main` after PR 2 merges.

### Task 3.1: Breakpoint hook and drag physics

**Files:**
- Create: `src/lib/use-is-desktop.ts`, `src/components/ui/sheet-drag.ts`, `src/components/ui/sheet-drag.test.ts`

**Interfaces:**
- Produces:
  - `useIsDesktop(): boolean` — `useSyncExternalStore` over `matchMedia("(min-width: 768px)")`; server snapshot `true`. Safe because sheet/menu content mounts only on open, after hydration.
  - `dragOutcome({ offset, height, velocity }: { offset: number; height: number; velocity: number }): "close" | "restore"` — `offset` px dragged down (negative = up), `velocity` px/ms downward. Close when `offset > height / 3`, or `velocity > 0.5 && offset > 24`; else restore.
  - `useSheetDrag(onClose: () => void): { handleProps: React.HTMLAttributes<HTMLElement>; contentStyle: React.CSSProperties }` — pointer events (`setPointerCapture`) on the handle/header only, never on scrollable content; translates the content with the finger (clamped at 0 upward), calls `dragOutcome` on release; restore animates back under `motion-safe` only.

- [ ] **Step 1: Write the failing tests**:

```ts
expect(dragOutcome({ offset: 140, height: 400, velocity: 0 })).toBe("close");
expect(dragOutcome({ offset: 120, height: 400, velocity: 0 })).toBe("restore");
expect(dragOutcome({ offset: 40, height: 400, velocity: 0.8 })).toBe("close");
expect(dragOutcome({ offset: 10, height: 400, velocity: 2 })).toBe("restore");
expect(dragOutcome({ offset: -50, height: 400, velocity: 0 })).toBe("restore");
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** `Add the breakpoint hook and sheet drag physics`.

### Task 3.2: The bottom sheet

**Files:**
- Create: `src/components/ui/bottom-sheet.tsx`, `src/components/ui/bottom-sheet.test.tsx`
- Modify: `src/components/studio/studio.tsx` (canvas sheet adopts `SheetHandle` + `useSheetDrag`)

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetTitle`, `SheetDescription` from `ui/sheet.tsx` (unchanged), Task 3.1.
- Produces:
  - `BottomSheet` = `Sheet` re-exported (`open`, `onOpenChange`).
  - `BottomSheetContent({ title, description, header, followKeyboard = false, className, children, onCloseAutoFocus })` — `SheetContent side="bottom" showCloseButton={false}`; `bg-popover rounded-t-2xl border-t max-h-[85dvh]`, inner scroll area, `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`; renders `SheetHandle` and `header` (or `title` as a visible heading) at the top; `title` is always the `SheetTitle` (visually hidden when `header` is given), `description` the `SheetDescription` (sr-only if absent). `followKeyboard` mounts `useVisualViewport()` (`src/components/studio/use-visual-viewport.ts`) and bottoms the sheet at `calc(100dvh - var(--viewport-top,0px) - var(--viewport-height,100dvh))` so a focused field stays above the iOS keyboard.
  - `SheetHandle(props: React.HTMLAttributes<HTMLDivElement>)` — 36×4px rounded `bg-border` bar, centred, in a 24px tall touch strip, `aria-hidden`.
  - `BottomSheetItem({ asChild, variant = "default", disabled, onSelect, children })` — full-width row `min-h-13 gap-4 px-2 text-base`, icon slot `text-muted-foreground`, destructive `text-destructive`; calls `onSelect` then closes the sheet (via `SheetClose` semantics).
  - `BottomSheetSeparator()` — Hairline.

- [ ] **Step 1: Write the failing test** (mock `@/components/ui/sheet` to render parts inline, as menu tests do): `BottomSheetContent` with `title="Rain & Release"` and no `header` renders the title as visible text and a handle element; a `BottomSheetItem variant="destructive"` carries `text-destructive`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**; move the studio canvas sheet onto `SheetHandle` + `useSheetDrag` (keep its `h-[88dvh]` and `md:hidden`). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `Add the drag-to-close bottom sheet`.

### Task 3.3: Responsive wrappers

**Files:**
- Create: `src/components/ui/responsive-menu.tsx`, `src/components/ui/responsive-dialog.tsx`, `src/components/ui/responsive-menu.test.tsx`

**Interfaces:**
- Consumes: `useIsDesktop`, `DropdownMenu*`, `Dialog*`, `BottomSheet*`.
- Produces (the same JSX at every call site; the mode comes from a context set by the root):
  - `ResponsiveMenu({ open?, onOpenChange?, children })`
  - `ResponsiveMenuTrigger({ asChild, children })`
  - `ResponsiveMenuContent({ header, title, align, className, onCloseAutoFocus, children })` — desktop: `DropdownMenuContent` (`header` not shown); phone: `BottomSheetContent` with `header` (cover thumbnail + title + meta line, the caller builds it) and `title` for the accessible name. `onCloseAutoFocus` is forwarded in **both** modes.
  - `ResponsiveMenuItem({ asChild, variant, disabled, onSelect, children })` → `DropdownMenuItem` | `BottomSheetItem`.
  - `ResponsiveMenuSeparator()`.
  - `ResponsiveDialog({ open, onOpenChange, title, description, footer, followKeyboard, children })` → `Dialog` + `DialogContent` (today's look) | `BottomSheet` + `BottomSheetContent`; `footer` becomes the sheet's bottom actions, full-width stacked buttons.

- [ ] **Step 1: Write the failing test**: mock `@/lib/use-is-desktop` to return `false`, mock the sheet and dropdown modules to inline markers; assert the phone render uses the sheet markers and the header text, and that a spy passed as `onCloseAutoFocus` reaches the sheet content's props. Repeat with `true` and assert dropdown markers.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** `Add responsive menu and dialog wrappers`.

### Task 3.4: Convert every surface

**Files (one commit per row is fine):**

| Surface | File | Change |
|---|---|---|
| Meditation "…" | `src/components/meditation-menu.tsx` (+ update `meditation-menu.test.tsx` mocks to `responsive-menu`) | `DropdownMenu*` → `ResponsiveMenu*`; header shows cover thumbnail, title, meta. Phone: Add to collection opens the collection sheet after the menu closes (keep the `collectionsNext` + `onCloseAutoFocus` pattern). |
| Add to collection | `src/components/add-to-collection-dialog.tsx` | `useIsDesktop()`: desktop keeps the anchored `Popover`; phone renders `BottomSheet` + `BottomSheetContent followKeyboard` with the same body. |
| Delete confirmation | `src/components/delete-dialog.tsx` | `Dialog` → `ResponsiveDialog`. |
| Collection card | `src/components/collection-card.tsx` | Menu → `ResponsiveMenu*` (keep the two-tap "Confirm delete" item); Edit form `Dialog` → `ResponsiveDialog followKeyboard`. |
| Session player menu | `src/components/session-player.tsx` | → `ResponsiveMenu*`; pass `className="dark"` to `ResponsiveMenuContent` so the sheet stays dark in the light theme. Add a markup test asserting the `dark` class on the phone render. |
| Add tag | `src/components/meditation-details.tsx` (`AddTagPopover`) | `useIsDesktop()`: Popover on desktop, `BottomSheetContent followKeyboard` on phone. |
| Discover filters | `src/app/(app)/discover/search.tsx` (`FilterSelect`) | `useIsDesktop()`: `Select` on desktop; on phone a trigger button showing the current value that opens a `BottomSheet` of options as `BottomSheetItem`s with a check icon on the selected one. |
| Chat "…" on Create | `src/components/studio/draft-chat-list.tsx` (+ its test) | → `ResponsiveMenu*`, header is the chat title. |

- [ ] **Step 1:** Convert each row, updating existing tests' mocks; keep their assertions.
- [ ] **Step 2:** `grep -rlE 'components/ui/(dropdown-menu|dialog|popover|select)"' src | grep -v components/ui/` returns only files that use them through `useIsDesktop()` desktop branches.
- [ ] **Step 3:** `npm test && npx tsc --noEmit` — PASS. **Commit** per row.

### Task 3.5: Docs and PR

- [ ] `DESIGN.md` Elevation: the bottom sheet surface (`--popover`, rounded top, Hairline top border, shadcn shadow kept as a floating layer) and the 52px sheet row; Layout: "Below `md`, every menu and dialog is a bottom sheet."
- [ ] `tasks/OPERATOR-TODO.md`: "On iPhone: drag a sheet closed by its handle; Add tag / Edit collection / new collection keep the field above the keyboard; the session player's menu sheet is dark in the light theme."
- [ ] Lint, tsc, test, build; verify per Global Constraints (including reduced motion on sheet open/close/spring-back); open the PR.
