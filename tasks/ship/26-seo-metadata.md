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
- Next.js 16 metadata docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata — useful to verify latest API.
- `metadataBase` should be set so relative OG image URLs resolve correctly in prod.
- For public meditation pages, generate metadata via `generateMetadata({ params })` — fetch the meditation server-side and set `title`/`description` from its content. Guard for private meditations (return a generic "Private meditation" title or return `notFound()` pre-render).
- `description` should be unique per page; avoid duplicating the same tagline everywhere.

## Open questions
- What's the product's one-line pitch? Need to lock this before writing the landing description. Current README: "AI-powered meditation script and audio generation platform" — usable, maybe sharpen.
