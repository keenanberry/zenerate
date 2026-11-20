# Meditation Ratings

**Status:** Backend done (card ZEN-5): the table, policies, endpoints and stats below.
UI done (card ZEN-6): the end-of-session prompt (`src/components/rating-prompt.tsx`,
at 90% through or the end of a counted play, so a seek to the end is not asked; "Not now"
held per meditation in `sessionStorage` for the browser session), the listener's own stars
on the meditation page, and the average and count on Discover's rows and results and on
the meditation page. How ZEN-6 settled the decisions below: stars on the page as well as
at the end of the session; the average shows from the first rating (the card asks for it
publicly; no three-rating threshold yet); stars fill in Primary; each star is a toggle
button in a named group rather than a radio group. Still open: Popular's tie-breaker,
seeded ratings, the display threshold once there is real data, and the Insight Timer
references the owner may send to refine the prompt's look.
**Priority:** Post-ship. Raised by the operator before launch (2026-10-31). It needs
listeners before it means anything, so nothing at launch depends on it.
**Related:** `src/components/session-player.tsx` (the session view, where a session
ends), `src/components/use-waveform-player.ts` (wavesurfer's `finish`),
`src/components/use-play-tracking.ts` (what counts as a listen),
`src/components/favorite-button.tsx` (the pattern for an optimistic per-listener
signal), `popular_meditations` in `supabase/migrations/20261022000036_discover_reads.sql`
and `POPULAR_MIN_SCORE` in `src/lib/meditation/discover.ts` (how Discover ranks today),
`src/lib/meditation/meta.ts` (the card's meta line).

## Why

When the audio ends, the listener has just formed an opinion and nothing asks for it.
Insight Timer asks for a 1–5 star rating at the end of every session, quietly, and the
rating feeds its catalogue. Here, Discover's Popular row ranks by favorites plus plays
with the owner excluded: a count of attention, not of whether it was any good. A rating is
the first quality signal, and it would let Discover show "4.8 · 12 ratings" on a card and
rank by it.

## The moment

- **Where:** the session view, once the audio finishes. In place of the transport, one
  Dusk line ("How was it?") and five stars, with a plain "Not now". Subtle: no dialog, no
  toast, no sound, nothing that moves. Dismissing or minimizing closes it.
- **Who:** a signed-in listener who is not the owner, on a public meditation, the same
  exclusions as plays and favorites. Signed out, nothing appears, not a sign-in prompt.
- **Only a real listen:** ask only when a play was counted in this session
  (`watchPlays` and its 30-second threshold), so a seek to the end is not asked.
- **Once:** a rated meditation shows its filled stars, tappable to change, and is never
  asked again. "Not now" is remembered for that meditation in `localStorage`, not in a
  row; a rating row exists only once someone rates.
- A listener who stops early is not asked, because there is no finish. Whether the stars
  also sit on the meditation page under the player, so a rating can be given or changed
  later, is a decision below.

## What ZEN-5 built

- **Migration** `supabase/migrations/20261120020000_meditation_ratings.sql`: the table as
  described under Data, the four own-row policies, column grants (insert
  `meditation_id, user_id, stars`; update `stars` only), a trigger that keeps
  `created_at`/`updated_at`, and `meditation_rating_stats`.
- **Endpoints**, `src/app/api/meditations/[id]/rating/route.ts`, all on the caller's client:
  - `GET` → `200 { rating: { stars, created_at, updated_at } | null }` (null for the owner).
  - `PUT { stars: 1..5 }` → `201 { rating }` new, `200 { rating }` changed.
  - `DELETE` → `204`, also when there was nothing to remove.
  - `401` signed out; `404` missing, private (even one's own) or not completed; `403` the
    owner rating their own; `400` a body that is not exactly `{ stars: int 1..5 }`.
- **Stats**: `meditation_rating_stats(p_meditation_ids uuid[])` returns
  `(meditation_id, average numeric rounded to 1 decimal, count bigint)` for public,
  completed meditations with at least one rating, any caller, at most 100 ids. Read it with
  `getRatingStats(supabase, ids)` in `src/lib/meditation/ratings.ts`, which batches and
  returns `Map<id, { average, count }>`; a missing id means no ratings (or not public).
- **Decided:** an owner cannot rate their own meditation (the policies and the `403`), as
  with plays and favorites. The stats function is named `meditation_rating_stats`, not
  `rating_summaries`, beside `meditation_authors`. No server action and no seeded ratings
  yet: ZEN-6 adds whichever its UI needs. Ranking needs the exact sum, which the function
  can add then.
- **Tests:** `src/lib/meditation/ratings.test.ts`, the route test beside it, and the opt-in
  `src/test/meditation-ratings.db.test.ts`; `owner-delete.db.test.ts` checks the cascade.

## Data

- `meditation_ratings (meditation_id, user_id, stars smallint check (stars between 1 and
  5), created_at, updated_at, primary key (meditation_id, user_id))`. One row per listener
  per meditation; rating again updates it. `user_id` cascades with the account, as
  favorites do, and `meditation_id` must be `on delete cascade` too: owners can delete a
  meditation (card ZEN-4, `DELETE /api/meditations/[id]`), and its ratings go with it.
  The opt-in `src/test/owner-delete.db.test.ts` lists every table that must be empty after
  a delete; add `meditation_ratings` to it.
- The rating belongs to the meditation, not a version: a re-render or a promoted draft
  keeps it.
- Security, following task 58: `anon` gets nothing; `authenticated` gets insert, update
  and select of its own rows with a column list, and the insert check requires the
  meditation to be public, completed and not the caller's own (as
  `meditation_plays.insert_own` checks visibility). Averages come from a security-definer
  function in the shape of `popular_meditations` (`rating_summaries(ids uuid[])` returning
  average and count), so no one reads another listener's rows. Opt-in DB tests in the
  style of `src/test/launch-security.db.test.ts` cover the denials: anon, the owner, a
  private meditation, a value outside 1–5.

## Discover

- **Show** "★ 4.8 · 12" on the card's meta line only once a meditation has at least three
  ratings; below that nothing, so one five-star from a friend is not a badge. The same
  reasoning as `POPULAR_MIN_SCORE`.
- **Rank** with a Bayesian average, never the plain mean: one five-star must not beat a
  hundred at 4.6. `(sum + prior_mean × prior_count) / (count + prior_count)`, prior mean
  the catalogue's mean, prior count about five.
- **Where it ranks:** first as a tie-breaker inside Popular. A "Top rated" row of its own
  once at least `ROW_SIZE` meditations clear the display threshold; before that the row
  would be padded with house picks and read as fake.
- A "Top rated" sort on the Discover list is a later slice.

## Design

Five stars as a radio group (`role="radiogroup"`, arrow keys, named "Rate this
meditation", each star "N stars"), outlines in Dusk, hover filling up to the hovered star.
The fill needs a colour: `--candle` is the warm amber the duration warning uses, and a
star in it would borrow a caution reading, so the design pass decides between Candle and a
new `--star` token in both `:root` and `.dark`. It sits on the session view's dark
surface, so verify there first, then on the page in light.

## Decisions to make

- End of session only, or also on the meditation page under the player.
- The display threshold (three) and the prior count (five) once there is real data.
- Candle or a new token for the filled star.
- Whether an owner can rate (no, as with plays and favorites) and whether a re-listen of a
  rated meditation asks again (no: the filled stars, tappable).

## Scope sketch

1. Migration: the table, RLS, column grants, `rating_summaries`, a few seeded ratings in
   `supabase/seed.sql` so Discover shows them locally, and the DB tests.
2. `rateMeditation(id, stars)` in `src/lib/meditation/actions.ts`: zod integer 1–5,
   upsert, the pattern of `toggleFavorite`.
3. A `RatingStars` component, optimistic like `useFavorite`, and the end-of-session
   prompt in the session view, gated on a counted play.
4. Discover reads the summaries for its rows and cards; Popular takes the tie-breaker;
   `docs/architecture.md`'s "Who Writes What" table gains the row.
5. Later: the average per meditation in the admin dashboard, and the Top rated row once
   enough meditations qualify.

## Not in scope

Written reviews and replies (a moderation surface; see
[public content moderation](./public-content-moderation.md)), ratings per version, a
rating on one's own meditations, and any reminder to rate later by push or email.
