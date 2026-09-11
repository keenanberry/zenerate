# Public Content Is Unreachable When Signed Out

**Status:** Not started
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

- [ ] A signed-out visitor can load `/discover` and see public meditations
- [ ] A signed-out visitor can load `/meditation/[id]` for a meditation where `is_public = true`
- [ ] A signed-out visitor loading `/meditation/[id]` for a **private** meditation gets `notFound()`, not a redirect and not a leak — verify the RLS row check is what produces this
- [ ] Public meditation audio plays for a signed-out visitor (the Phase 0 Task 3 signing path must work without a session — confirm, since the signer runs service-role behind an RLS-bound fetch and an anonymous fetch is a different RLS context)
- [ ] Authed-only routes still redirect: `/dashboard`, `/create`, `/collections/[id]`
- [ ] Owner-only affordances stay hidden when signed out on a public page: visibility toggle, generate-audio panel, quota display, favourite, add-to-collection
- [ ] The nav renders sensibly with no session — "Sign in" rather than "Sign out", no Library/Create links
- [ ] `curl` the public meditation URL with no cookies and confirm a 200 with the meditation title in the HTML, so a crawler genuinely sees content

## Implementation notes

- The likely shape is splitting the route group: move the genuinely-authed routes under a gated layout and let `/discover` and `/meditation/[id]` sit in a group whose layout does not redirect. Next.js route groups don't affect the URL, so this is a file move plus a layout split, not a URL change.
- `src/app/(app)/meditation/[id]/page.tsx` already handles the anonymous case partly — it computes `isOwner` from `user?.id` and guards the quota and free-retry lookups behind `user && isOwner`. That suggests the page was written expecting anonymous visitors; only the layout blocks them.
- `getMeditation` in `src/lib/meditation/actions.ts` selects through the RLS-bound client, so an anonymous request should already return only public rows. Verify rather than assume — anonymous requests run as the `anon` role, which is a different RLS context from an authenticated user.
- Check `src/components/nav.tsx`, which currently assumes a session and renders a sign-out button unconditionally.
- Do not weaken any RLS policy to make this work. If a public page can't read what it needs, the fix is in routing or in the query, not in the policy.

## Open questions

- Should `/discover` be fully public, or public-but-teaser (list visible, playback requires an account)? Fully public is the better default for a launch that wants to be shared, and it's what the SEO task assumes. Confirm before building.
