# Public Content Is Unreachable When Signed Out

**Status:** Done
**Priority:** Ship-blocker
**Phase:** 2 (product completeness)
**Found:** 2026-09-11, during Phase 0 Task 3 verification
**Blocks:** 26 (SEO metadata assumes public meditation pages are crawlable)

## Why this blocks ship

`src/app/(app)/layout.tsx` gates the entire `(app)` route group:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  redirect("/login");
}
```

That redirect fires for every unauthenticated visitor regardless of `meditations.is_public`. `/discover` and `/meditation/[id]` both live under `(app)`, so:

- A signed-out visitor who clicks **Explore** on the landing page (`src/app/page.tsx`) lands on the login screen.
- A shared link to a public meditation lands on the login screen.
- Search engines are signed-out visitors. Every public page is uncrawlable, which makes task 26's `robots.txt`, sitemap, and per-meditation `generateMetadata` work pointless — there is nothing for a crawler to reach.

So the entire public-content feature — `is_public`, the RLS policies behind it, the visibility toggle, `/discover` — currently only works for people who already have an account. The data layer is correct; the routing contradicts it.

This was discovered while verifying Phase 0 Task 3 (audio URL privacy). It is pre-existing and unrelated to that task's changes.

## Acceptance criteria

- [x] A signed-out visitor can load `/discover` and see public meditations
- [x] A signed-out visitor can load `/meditation/[id]` for a meditation where `is_public = true`
- [x] A signed-out visitor loading `/meditation/[id]` for a **private** meditation gets `notFound()`, not a redirect and not a leak — verify the RLS row check is what produces this
- [x] Public meditation audio plays for a signed-out visitor (the Phase 0 Task 3 signing path must work without a session — confirm, since the signer runs service-role behind an RLS-bound fetch and an anonymous fetch is a different RLS context)
- [x] Authed-only routes still redirect: `/dashboard`, `/create`, `/collections/[id]`
- [x] Owner-only affordances stay hidden when signed out on a public page: visibility toggle, generate-audio panel, quota display, favourite, add-to-collection
- [x] The nav renders sensibly with no session — "Sign in" rather than "Sign out", no Library/Create links
- [x] `curl` the public meditation URL with no cookies and confirm a 200 with the meditation title in the HTML, so a crawler genuinely sees content
- [x] The anonymous audio path itself is verified end-to-end: `curl -sI` the signed audio URL returned for a public meditation with no session and confirm a 200. Phase 0 Task 3 (audio URL privacy) could not test its signed-out cases because anonymous visitors could not reach a meditation page at all before this task — that verification is inherited here, not assumed complete

- [x] Downloads stay account-only: no Download button signed out (a "Sign in to download" prompt in its place), and `/api/audio/[id]/download` returns 401 with no session

## Outcome (2026-10-08)

- **Routing:** `(app)/layout.tsx` no longer redirects. `dashboard`, `create` and `collections/[id]` moved into a nested `(app)/(authed)/` group whose layout is the sole auth gate. URLs are unchanged.
- **Grant:** `20261008000000_grant_anon_select_meditations.sql` grants `anon` SELECT on `meditations` only, behind the same RLS gate as the earlier grants migration. The signed-out pages read no other table: favourites are skipped when there is no user.
- **Verified locally** with no cookies: `/discover` and a public meditation return 200 with the title in the HTML. A private meditation returns 404. `/dashboard`, `/create` and `/collections/x` return 307 to `/login`. The signed audio URL returns 200 and the download route returns 401. Signed in as a non-owner, the download returns 200 with the slugified filename. As `anon` in psql, 7 private rows return 0, and the same table with one row flipped public returns 1.
- **Not verifiable locally:** the grant itself. Local grants `anon` everything, so only production proves it. After this deploys, run `curl` on a public meditation URL in production with no cookies.

**Decisions**
- **Fully public**, per the open question below, so shared links play.
- **Downloads are account-only.** This is an incentive to sign up, not protection: a signed-out listener already holds the signed URL the player streams from. The route's 401 exists because `getMeditation` alone would now serve public rows to anyone.

## Implementation notes

- The likely shape is splitting the route group: move the genuinely-authed routes under a gated layout and let `/discover` and `/meditation/[id]` sit in a group whose layout does not redirect. Next.js route groups don't affect the URL, so this is a file move plus a layout split, not a URL change.
- `src/app/(app)/meditation/[id]/page.tsx` already handles the anonymous case partly — it computes `isOwner` from `user?.id` and guards the quota and free-retry lookups behind `user && isOwner`. That suggests the page was written expecting anonymous visitors; only the layout blocks them.
- `getMeditation` in `src/lib/meditation/actions.ts` selects through the RLS-bound client, so an anonymous request should already return only public rows. Verify rather than assume — anonymous requests run as the `anon` role, which is a different RLS context from an authenticated user.
- Check `src/components/nav.tsx`, which currently assumes a session and renders a sign-out button unconditionally.
- Do not weaken any RLS policy to make this work. If a public page can't read what it needs, the fix is in routing or in the query, not in the policy.

## Open questions

- *(Resolved: fully public, downloads account-only.)* Should `/discover` be fully public, or public-but-teaser (list visible, playback requires an account)? Fully public is the better default for a launch that wants to be shared, and it's what the SEO task assumes. Confirm before building.
