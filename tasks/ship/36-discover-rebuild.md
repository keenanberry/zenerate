# Discover Rebuild

**Status:** Done (PR #59); the production signed-out `curl` is the operator's after deploy
**Priority:** Phase 5, Wave B. The public face at launch.
**Phase:** 5 (Discover)
**Depends on:** 28; `tags.ts` from 29; 35 (start with a placeholder cover slot)
**Skill:** `zenerate-design`
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`
**Supersedes:** the post-ship tags-and-filters task (removed 2026-10-20; read it in git history for the vocabulary reasoning) and `docs/ui-roadmap.md` item 1

## Why

The operator: `/discover` "doesn't feel like a public page where you discover cool
things." The model is Spotify's Search tab.

## Scope

- **Layout, top to bottom:**
  - A search bar, with filters beside or inside it: tag, type, and duration buckets
    (5 / 10 / 15 / 20+).
  - A grid of the 8 `DISCOVER_CATEGORIES` cards. Each opens a filtered list, at
    `/discover/[category]` or as a filter state; the builder chooses.
  - A **Popular** row.
  - A **Picked for you** row.
  - A results list replaces the rows while a search or filter is active.
- **Search:** `search @@ websearch_to_tsquery` over 28's column, ranked. Replace the
  current `ilike` in `getPublicMeditations`.
- **Popular:**
  - The ranking is favorites plus plays by signed-in listeners, through a
    `security definer` SQL function `popular_meditations(limit int)`, granted to `anon`.
  - Until the top results have meaningful counts (builder's threshold), fall back to
    `is_featured` house picks, so the row is never one card.
- **Picked for you:**
  - Signed in: public meditations sharing tags with your favorites and your own
    meditations, excluding your own.
  - Signed out, or with no history: `is_featured`.
- **Play tracking:** the player inserts one `meditation_plays` row per play when signed
  in. It counts once the play passes 30 seconds; record nothing signed out.
- **Signed-out access works in production:** every new function and column read here
  needs its `anon` grant. Local grants `anon` everything, so verify with `curl` against
  production after deploy.

## Acceptance criteria

- [x] Searching "sleep" finds a meditation tagged `sleep` whose title doesn't say "sleep".
- [x] Every category card opens onto at least 3 meditations on seeded local data.
  Locally, run a seed of 24 tagged public meditations through `seed.sql`; production
  gets 37's real ones.
- [x] Popular and Picked for you each show at least 3 cards signed out, with house picks.
- [x] A test proves a signed-out play writes nothing, and a signed-in play writes one row
  per play past 30 seconds.
- [x] Dark, then light, then phone. At phone width it reads like a native search tab:
  the search bar is reachable and the category grid is 2 columns.
- [ ] After deploy, production `curl` with no cookies returns `/discover` with
  categories and rows rendered.

## Outcome

**What shipped**

- `/discover` is laid out like Spotify's Search tab: a 48px search bar with Tag, Type
  and Length filters under it, the 8 category cards ("Browse by feeling"), then a
  Popular row and a Picked for you row. Rows are horizontal shelves that scroll inside
  the column, never the page. While a search or any filter is active, a results list
  (the existing list/grid view) replaces the cards and rows, with removable filter chips
  and "Clear all".
- **Category route:** a filter state, `/discover?category=sleep`, not
  `/discover/[category]`. One page, one URL scheme, and a category combines with search
  and the other filters for free. All state is in the URL (`q`, `category`, `tag`,
  `type`, `duration`), parsed and validated against the vocabulary in
  `src/lib/meditation/discover.ts`.
- **Search:** migration `20261022000036_discover_reads.sql` adds
  `discover_meditations(...)`, a `security invoker` SQL function (RLS still applies):
  `search @@ websearch_to_tsquery('english', q)`, ordered by `ts_rank`, plus the
  category (`tags && any`), tag, type and duration filters. `getPublicMeditations(filters)`
  calls it; the `ilike` is gone. Typing debounces 300ms and uses `router.replace`, so
  Back skips half-typed queries; focus stays in the field.
- **Popular:** `popular_meditations(row_limit int)`, `security definer`, returns only
  `(meditation_id, favorites, plays, score)` for public, completed meditations. The owner's
  own favorites and plays are excluded. The app lets a meditation lead the row at
  `score >= 2` (`POPULAR_MIN_SCORE`) and pads the row to 8 with `is_featured` house picks.
- **Picked for you:** signed in, public meditations that share tags with your favorites
  and your own meditations, weighted by how often each tag appears there, never your own,
  padded with house picks. Signed out or with no tags: house picks.
- **Play tracking:** `watchPlays` in `src/components/use-play-tracking.ts` counts one play
  per pass once 30 seconds have actually been *heard* (accumulated from `timeupdate`, so a
  seek to minute five does not count; a pause and resume is the same play; `ended`, or a
  counted play restarted from the top, starts a new one). The meditation-page player calls
  the `recordPlay` server action through it only when `trackPlays` (= signed in) is set.
  `recordPlay` also refuses without a user, so a signed-out play writes nothing on either
  side.
- **Seed:** 24 tagged public, completed meditations in `supabase/seed.sql`, three per
  category, 8 of them `is_featured`. No audio (local storage is empty after a reset).
- Task 33's `TagPills` and task 35's `MeditationCover` merged while this was in progress,
  so the Discover shelves use the real components; no placeholders ship.

**Evidence**

- psql as `anon` (local): `has_function_privilege('anon', ...)` is true for both functions
  and false for `PUBLIC`; with the anon grant revoked inside a transaction, both calls fail
  with `permission denied for function ...`. That proves the migration's grant is what
  makes signed-out Discover work, not local Postgres's default privileges (which also
  let anon read `favorites` locally, so a plain query would prove nothing).
  `popular_meditations` as anon returned counts for a public meditation only, with the
  owner's own play excluded and a private meditation's play ignored.
- `discover_meditations(q => 'sleep')` returns "Drifting Off on the Tide" (tagged `sleep`,
  no "sleep" in the title); the UI shows the same.
- Signed-out `curl` (no cookies) on local `/discover`: 8 category cards, Popular 8 cards,
  Picked for you 8 cards ("House picks to start with."); every
  `/discover?category=<slug>` lists 3 to 7.
- Tests: `use-play-tracking.test.ts` (threshold, pause, seek, one count per pass, restart);
  `record-play.test.ts` (signed out: no `from()` and no insert; signed in: two rows for two
  passes past 30s and none for a 10s one); `discover.test.ts` (URL parsing, buckets
  cover 1 to 90 min exactly once, row fill, tag affinity).
- End to end, signed in on local: a 60s test track on the meditation page wrote 0 rows at
  20s, 1 row after 30s, and still 1 after the track ended. The test row and its audio
  were deleted afterwards.
- Design: dark desktop (1280), dark 390px (no page horizontal scroll, `scrollWidth` 390;
  2-column category grid), light at both widths. `impeccable detect` on the changed files
  returned `[]`.

**Decisions**

- The function parameter is `row_limit`, not `limit`: `limit` is reserved in SQL and
  would need quoting at every call. The signature is still `popular_meditations(int)`.
- Popular is all-time, not windowed. With real counts, a 30 or 90 day window on plays is
  a one-line change to the function.
- Only the meditation-page player counts plays. The small play buttons on cards and track
  rows are previews and do not count; the brief scoped tracking to the player.
- Duration buckets are on `settings.duration` (the target minutes): 5 is up to 7, 10 is
  8 to 12, 15 is 13 to 17, 20+ is 18 and up.
- Locally the migration was applied with `psql` and recorded in
  `supabase_migrations.schema_migrations` (no reset), and the seed block was inserted
  with targeted SQL, per the coordinator's local DB rule.

**For the operator**

- The migration deploys to production on merge. It is additive (two functions and their
  grants), so nothing has to happen before the merge.
- After deploy: `curl -s https://<prod>/discover` with no cookies should show the 8
  category cards and both rows. Until task 37 marks house picks with `is_featured`, both
  rows in production are empty and hidden, so set `is_featured = true` on the house set
  first (the rows need at least 3).
- Phone check on a real device: the search bar and the 2-column grid at the top, the
  shelves swipe sideways.
