# Bookmarks ("save for later")

**Status:** Backend done (card ZEN-7, 2026-11-20). UI is card ZEN-8: a save control on
Discover cards and the meditation page, and a list (on `/account` or the dashboard).
**Related:** `favorites` (`supabase/migrations/20250221000000_create_meditations.sql`,
`src/components/favorite-button.tsx`, `toggleFavorite` in `src/lib/meditation/actions.ts`),
`src/lib/meditation/ratings.ts` (the pattern this follows).

## Why

A listener on Discover sees something they want to hear, but not now. Nothing keeps it
for them. A bookmark is that: "save for later", a private queue to come back to.

## Decision: a new table, not favorites (2026-11-20)

Favorites already exist, so the first question was whether they already mean "saved for
later". They do not:

- **What it says.** The UI is a heart labelled "Add to favorites" / "Remove from
  favorites", with its own **Favorites** tab on the dashboard. That reads "I liked this",
  not "I'll listen later". Someone may like something they have heard and want to keep
  nothing queued, or queue something they have never heard.
- **What it feeds.** Favorites count toward Popular (`popular_meditations`) and drive
  Picked for you (`getPickedForYou` weights tags by them). Saving something to try later
  is not a signal it is good, and must not rank it.
- **What it allows.** A favorite can point at any meditation (its insert policy checks
  only `user_id`), and the favorites list shows them whatever their status. Bookmarks are
  for public, finished meditations, and the list hides one that went private.

So bookmarks are their own table, `meditation_bookmarks`, and favorites are unchanged.

| | Favorites | Bookmarks |
|---|---|---|
| Means | "I liked this" | "Save for later" |
| Counts toward | Popular, Picked for you | Nothing |
| Can point at | Any meditation the caller can see | Public, completed only |
| Owner's own | Allowed | Allowed (same rule) |
| Went private since | Still listed | Hidden from the list; still removable |
| API | `toggleFavorite` server action | `PUT`/`DELETE /api/meditations/[id]/bookmark`, `GET /api/bookmarks` |

The owner may bookmark their own public meditation because favorites allow it. Ratings
exclude the owner because a rating is a signal; a bookmark is not.

## What ZEN-7 built

- **Migration** `supabase/migrations/20261120030000_meditation_bookmarks.sql`:
  `meditation_bookmarks (user_id, meditation_id, created_at)`, primary key
  `(user_id, meditation_id)`, both foreign keys `on delete cascade`, indexes on
  `(user_id, created_at desc, meditation_id desc)` for the list and on `meditation_id` for
  the cascade. Policies: `select_own`, `insert_own` (a public, completed meditation),
  `delete_own` (always). Grants: select; insert `user_id, meditation_id` only, so
  `created_at` cannot be backdated; delete; no update. `anon` gets nothing.
- **Endpoints**, all on the caller's client, `Cache-Control: no-store`:
  - `PUT /api/meditations/[id]/bookmark` → `201 { bookmarked: true }` new,
    `200 { bookmarked: true }` already there. No body.
  - `DELETE /api/meditations/[id]/bookmark` → `204`, also when there was nothing to
    remove, and on a meditation that went private since.
  - `GET /api/bookmarks?limit=1..100&cursor=…` → `200 { bookmarks, next_cursor }`, newest
    first, 50 by default. Each bookmark is `{ bookmarked_at, meditation }`, and meditation
    is `{ id, title, description, tags, settings, status, created_at, author, rating }`:
    `author` is `{ id, display_name, avatar_url } | null` (`getMeditationAuthors`, public
    profiles only), `rating` is `{ average, count } | null` (`getRatingStats`). The cover
    is drawn from `id`, `tags` and `title` (`MeditationCover`); the length is
    `settings.duration` (`metaLine`). No script and no audio URL: signed URLs are minted
    only in `src/lib/meditation/actions.ts`, so a card that plays in place reads through
    there. Pass `next_cursor` back as `?cursor=` for the next page; it is `null` on the
    last. Keyset paging on `(created_at, meditation_id)`, so adding or removing between
    pages neither repeats nor skips.
  - `401` signed out; `404` missing, private (even one's own) or not completed; `400` a
    bad `limit` or `cursor`.
- **Helpers** in `src/lib/meditation/bookmarks.ts` (each takes the caller's RLS-bound
  client):
  - `getBookmarkedIds(supabase, userId | null, meditationIds) → Set<string>`: which of
    the ids the caller has bookmarked, one query per 100 ids; signed out it reads nothing.
    For Discover's filled or empty state with no N+1, in the way `markFavorites` sets
    `is_favorited`.
  - `listBookmarks(supabase, userId, { limit?, cursor? }) → BookmarkPage`, for a server
    component that lists them without going through the route.
  - `addBookmark` / `removeBookmark(supabase, userId, id)` →
    `{ ok: true, value } | { ok: false, reason: "not_found" }`, for a server action.
- **Tests:** `src/lib/meditation/bookmarks.test.ts`, the two `route.test.ts` files, the
  opt-in `src/test/meditation-bookmarks.db.test.ts`, and `owner-delete.db.test.ts` now
  checks the bookmark cascade.

## For ZEN-8

- `MeditationWithMeta` has no `is_bookmarked` yet; add it beside `is_favorited` and set
  it with `getBookmarkedIds` where `markFavorites` runs.
- Nothing revalidates on a bookmark change: no server-rendered page reads bookmarks yet.
  A server action that wraps `addBookmark` should `revalidatePath` what it shows.
- `/privacy` lists what deleting an account removes ("favorites, collections, plays and
  usage records"); bookmarks go too, by cascade. Add them when the UI ships.
