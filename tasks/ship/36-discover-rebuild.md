# Discover Rebuild

**Status:** Not started
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

- [ ] Searching "sleep" finds a meditation tagged `sleep` whose title doesn't say "sleep".
- [ ] Every category card opens onto at least 3 meditations on seeded local data.
  Locally, run a seed of 24 tagged public meditations through `seed.sql`; production
  gets 37's real ones.
- [ ] Popular and Picked for you each show at least 3 cards signed out, with house picks.
- [ ] A test proves a signed-out play writes nothing, and a signed-in play writes one row
  per play past 30 seconds.
- [ ] Dark, then light, then phone. At phone width it reads like a native search tab:
  the search bar is reachable and the category grid is 2 columns.
- [ ] After deploy, production `curl` with no cookies returns `/discover` with
  categories and rows rendered.
