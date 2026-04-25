# User Profiles

**Status:** Not started
**Priority:** Post-ship

## Why it matters

Two unrelated needs converge on the same surface:

1. **Identity for Discover.** Public meditations on `/discover` currently show a meditation but no author. Users browsing should see who created the content — both as social proof and as a path to follow / explore that creator's other public meditations. A public-facing profile is the natural home for this.
2. **Account self-service.** Private settings — quota visibility, email change, password change, account deletion, future paid-tier billing portal — need a home that isn't `/dashboard` (which is a content library, not a settings page). Today the dashboard quota indicator was deliberately removed because it didn't belong there.

## Scope sketch

### Schema
- `public.user_profiles` table, 1:1 with `auth.users` (FK on `id = auth.users.id`).
  - Public columns: `display_name`, `avatar_url`, `bio` (short, plain-text), `is_public_profile boolean default false`, `created_at`.
  - Optional later: `pronouns`, `links jsonb` (twitter/site), `featured_meditation_id`.
- RLS: anyone can `select` rows where `is_public_profile = true`; users can `select`/`update` their own row regardless.
- Trigger or server-side: insert a default profile row on `auth.users` insert (or lazy-create on first profile load).

### Public profile page
- Route: `/u/[handle]` or `/u/[user_id]` — pick one. Handle requires uniqueness + reservation rules; user_id avoids that complexity but yields uglier URLs.
- Renders: avatar, display name, bio, count of public meditations, list of their public meditations (paginated).
- Linked from `/discover` cards and from the meditation detail page (e.g., "by @keenan").

### Private settings page
- Route: `/account` (suggested).
- Sections:
  - **Profile** — edit display name, bio, avatar, public/private toggle.
  - **Usage** — render `getQuotaUsage()` indicator: "X of Y audio generations used this month, resets <date>". This is the natural home that ship task `03` deferred. Pull `is_free_retry`-aware "used" the same way the meditation page does today.
  - **Account** — change email/password (Supabase built-in flows), sign out, **delete account** (hard delete: cascade through `meditations`, `audio_generation_events`, `collections`, etc.).
  - **Billing** (when paid tier ships per `paid-tier.md`) — Stripe customer portal link.

### Wiring
- Replace plain author rendering on `/discover` with a `<ProfileLink userId>` that resolves display name + avatar.
- Existing `getQuotaUsage()` and `isFreeRetryAvailable()` helpers in `src/lib/audio/quota.ts` already do the work; the account page just calls them server-side.
- Avatar storage: Supabase Storage bucket `avatars/`, similar policy to `meditation-audio`.

## Key decisions to make

- **Handles vs. user IDs in URLs.** Handles read better but introduce reservation, profanity, squatting concerns. UUIDs sidestep all of that. A reasonable middle ground: optional handle that defaults to a UUID-derived slug.
- **Default privacy.** Profiles default-private (opt-in to public) feels safer; opt-out (default public) drives more Discover engagement. Probably default-private with a clear "make profile public" toggle next to the existing "make meditation public" one.
- **Display name uniqueness.** Probably not required (social-network-ish). But if we link to `/u/handle`, the handle field needs uniqueness even if `display_name` doesn't.
- **What happens when someone makes their profile private after public meditations exist?** Options: hide all their meditations from Discover, keep meditations visible but anonymize the author, or keep both visible (status quo). Probably option 1 to respect the toggle.
- **Account deletion semantics.** Hard delete (cascade) vs. soft delete (anonymize but keep meditations on Discover). GDPR/CCPA default expectation is hard delete on request; consider whether public meditations get scrubbed or transferred to an "anonymous" tombstone.

## Implementation notes

- The simplest profile page is a server component in `src/app/(app)/account/page.tsx` plus a public route `src/app/u/[id]/page.tsx` (note: outside `(app)` route group since public profile must be visible without auth).
- For the avatar field, follow the existing audio-upload pattern in `src/lib/audio/storage.ts`. Restrict file types and sizes server-side.
- The Discover page's meditation card likely already queries `meditations` joined to `auth.users` indirectly via RLS — extend it to also pull `display_name` / `avatar_url` from `user_profiles`. A view (`public_meditations_with_author`) might cleanly encapsulate this.
- Public profile RLS is the trickiest piece — ensure unauthenticated visitors can read public rows. Use `using (is_public_profile = true)` for the `select` policy plus a separate `using (auth.uid() = id)` so owners always see their own row.

## Open questions

- Do we want followers / following at any point? Probably not for a v1 profile, but the data model should leave room (`follows` table is straightforward to add later).
- Verified creators (badge on profile)? Consider once moderation surfaces (`public-content-moderation.md`) exist.
- Profile activity feed (recent meditations, "X liked this")? Out of scope for v1; deferred.
