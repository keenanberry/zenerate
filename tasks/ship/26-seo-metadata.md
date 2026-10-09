# SEO Metadata

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
`src/app/layout.tsx:19` now exports a basic `metadata` with title and description, but there is no `metadataBase`, no `openGraph` block, no OG image, no `robots.txt` and no sitemap. Social shares on Twitter, Slack and iMessage render as bare links.

## Acceptance criteria
- [ ] `src/app/layout.tsx` metadata extended with `metadataBase` (from `NEXT_PUBLIC_SITE_URL`) and a default `openGraph` object — title and description already exist
- [ ] Open Graph image wired into metadata — the 1200×630 image itself is produced by task 23
- [ ] Favicon verified — note `src/app/favicon.ico` is still the Next.js default; the real icon set comes from task 23
- [ ] Twitter card type set to `summary_large_image`
- [ ] Per-page overrides where it matters: landing (`/`), discover (`/discover`), public meditation pages (`/meditation/[id]` when `is_public`) — dynamic title = meditation title
- [ ] `robots.txt` (static in `public/` or via `src/app/robots.ts`) allowing crawl of marketing + public pages, disallowing authed routes
- [ ] `sitemap.xml` via `src/app/sitemap.ts` listing the landing + any public discover content — static list is fine for v1

## Implementation notes
- **`/meditation/[id]` must stay dynamically rendered and cookie-bound — do not make it
  static or ISR.** The page embeds a signed audio URL with a 4-hour TTL
  (`AUDIO_URL_TTL_SECONDS` in `src/lib/audio/signed-url.ts`) minted per-request from the
  viewer's own RLS-bound fetch. Static or ISR rendering would bake one visitor's signed URL
  into a cache shared across all viewers of that page — serving one user's private,
  time-limited URL to everyone else, and then, once the 4-hour window passes, serving a
  dead link to everyone until the next regeneration. `generateMetadata` for this route must
  not change that render mode.
- Next.js 16 metadata docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata — useful to verify latest API.
- `metadataBase` should be set so relative OG image URLs resolve correctly in prod.
- For public meditation pages, generate metadata via `generateMetadata({ params })` — fetch the meditation server-side and set `title`/`description` from its content. Guard for private meditations (return a generic "Private meditation" title or return `notFound()` pre-render).
- `description` should be unique per page; avoid duplicating the same tagline everywhere.

## Open questions
- *(Resolved 2026-10-09, in `PRODUCT.md`: "Meditations composed for you, not picked from a
  catalogue." Use it as the default description; per-page descriptions still differ.)*
  ~~What's the product's one-line pitch?~~
