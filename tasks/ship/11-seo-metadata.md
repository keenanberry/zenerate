# SEO Metadata

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
The root layout has no `metadata` export, so the landing page shows up as "Next.js App" or similar default in search results and social shares. First impressions on Twitter, Slack, iMessage previews all look broken.

## Acceptance criteria
- [ ] `src/app/layout.tsx` exports a `metadata: Metadata` with `title`, `description`, and a default `openGraph` object
- [ ] A static Open Graph image at `public/og-image.png` (1200×630) — simple branded image, hand-designed or generated
- [ ] Favicon verified (already exists — spot-check in a browser)
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
