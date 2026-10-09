# SEO Metadata

**Status:** Done* — *share previews on real apps (iMessage, Slack, X) and the Facebook debugger need the production deploy; the operator's, after merge
**Priority:** Ship-blocker

## Why this blocks ship
`src/app/layout.tsx:19` now exports a basic `metadata` with title and description, but there is no `metadataBase`, no `openGraph` block, no OG image, no `robots.txt` and no sitemap. Social shares on Twitter, Slack and iMessage render as bare links.

## Acceptance criteria
- [x] `src/app/layout.tsx` metadata extended with `metadataBase` (from `NEXT_PUBLIC_SITE_URL`) and a default `openGraph` object — title and description already exist
- [x] Open Graph image wired into metadata — the 1200×630 image itself is produced by task 23
- [x] Favicon verified — note `src/app/favicon.ico` is still the Next.js default; the real icon set comes from task 23
- [x] Twitter card type set to `summary_large_image`
- [x] Per-page overrides where it matters: landing (`/`), discover (`/discover`), public meditation pages (`/meditation/[id]` when `is_public`) — dynamic title = meditation title
- [x] `robots.txt` (static in `public/` or via `src/app/robots.ts`) allowing crawl of marketing + public pages, disallowing authed routes
- [x] `sitemap.xml` via `src/app/sitemap.ts` listing the landing + any public discover content — static list is fine for v1
- [ ] Share previews render on real apps (iMessage, Slack, X) and pass the Facebook sharing debugger against `www.zeneratestudio.com` (operator, after merge)

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

## Outcome (2026-10-09)

### What shipped
- `src/lib/seo/metadata.ts`: the site origin, the defaults and the per-page builders, all
  pure, with 17 tests in `metadata.test.ts`.
  - `resolveSiteUrl` reads `NEXT_PUBLIC_SITE_URL`. It accepts a bare host, keeps only the
    origin, and falls back to `https://www.zeneratestudio.com` when the value is unset or
    malformed.
  - `defaultMetadata` (spread into the root layout) sets `metadataBase`, the locked pitch
    as the default description, the OG block (`website`, site name, `en_US`, the
    1200×630 `/og-image.png` with alt text) and a `summary_large_image` Twitter card.
  - `pageMetadata` gives a page its own title, description, canonical URL and share card.
  - `meditationMetadata` and `describeMeditation` build the meditation page's metadata.
  - `sitemapEntries` builds the sitemap rows.
- Per-page metadata with a unique description each: `/` (what the app does), `/discover`
  (public meditations, free, no account) and each public `/meditation/[id]`. A
  meditation's description is built from its settings, e.g. "A 20-minute sleep meditation
  on letting go, written and narrated with AI on Zenerate. Free to listen, no account
  needed."
- `src/app/robots.ts` allows `/`, `/discover`, `/meditation/`, `/terms` and `/privacy`. It
  disallows `/dashboard`, `/create`, `/collections`, `/api/`, `/login` and `/auth/`, and
  points at the sitemap.
- `src/app/sitemap.ts` lists the landing, `/discover`, `/terms`, `/privacy` and every
  public, completed meditation. It reads them live with a cookie-less `anon` client and
  is regenerated at most hourly (ISR).
- `.env.example` documents `NEXT_PUBLIC_SITE_URL`.
- Coordinator follow-up: PRODUCT.md's Logo, Domain and Evidence lines now describe the
  shipped mark, OG image and the one hardcoded domain. DESIGN.md gains the mark beside
  the nav wordmark and a Brand Mark component entry, in prose and front matter.

### Decisions
- **`/meditation/[id]` stays dynamic.** `generateMetadata` and the page share a single
  read through React `cache()`. That cache is request-scoped, so the read stays
  cookie-bound and keeps nothing between viewers. Nothing uses `revalidate`,
  `unstable_cache` or `"use cache"`, and a comment says why. As a side effect, the second
  `getMeditation` call and second signed-URL mint that `main` made on every view are gone.
- **Private meditations.** The metadata never shows a viewer more than the page body
  already shows them.
  - For anyone but the owner, RLS returns nothing for a private meditation, so it looks
    like a missing one: a 404 with the root title and noindex, and no content.
  - Only the owner can read a private meditation. They see its title in their own tab,
    with no description, no share card and `noindex`. This keeps the library's tabs
    readable.
  - The brief's literal "generic title for private" would have named every tab in the
    owner's library "Private meditation", even though no other viewer can reach the row.
    If that is preferred, it is a one-line change in `meditationMetadata`.
- **Description from settings, not `prompt`.** The stored prompt is the wizard's
  instruction to the model ("Generate a 10-minute guided meditation. Focus/intention:
  …"), not prose.
- **Sitemap reads live and is cached.** It is cookie-less and per-viewer-free, so ISR is
  safe here, unlike the meditation page. When the read fails (CI has no database), it
  logs the failure and lists the four static pages; the build never fails over it.
  Because the segment `revalidate` also puts the Supabase fetch in Next's data cache, a
  newly published meditation can take up to about two hours to appear.
- **Extra robots rules.** `/auth/` is disallowed alongside the brief's list, because it
  is the OAuth and email callback.

### Evidence
- `npm run build` route table: `ƒ /meditation/[id]` (dynamic, as on `main`),
  `○ /robots.txt`, `○ /sitemap.xml` with a 1h revalidate.
- Production server (`next start -p 3126`), view-source checked with `curl` as
  `Twitterbot` and as Safari:
  - `/`, `/discover` and a public meditation each carry their own `<title>`,
    description, canonical, `og:*` and `twitter:*` tags. The image URLs are absolute
    against `metadataBase`.
  - The favicon, manifest and apple-touch-icon links are intact on every page. The
    favicon is task 23's rebuilt 16/32/48px ICO, no longer the Next.js default. And
    `/og-image.png` returns 200 `image/png`.
- A private meditation:
  - Signed out, it returns 404 with no meditation content in the head.
  - Fetched with alice's session cookie, it shows its own title, `robots: noindex`, and
    the default description and OG block.
- Dedupe: a temporary log in `getMeditation` (reverted) fired once for a 200 render of
  the meditation page, which runs both `generateMetadata` and the page.
- Sitemap:
  - It listed a public meditation once one existed. Local data had none, so I inserted
    one temporary row and deleted it afterwards; seed data was not touched.
  - A build with CI's dummy Supabase env and `NEXT_PUBLIC_SITE_URL=http://localhost:3126`
    exited 0. It logged the failed read, listed the four static pages, and resolved
    robots and the sitemap against the override.
- lint 0 errors (3 warnings already on `main`), `tsc` clean, 249/249 tests, build green.
- `impeccable detect` on the changed files reported nothing. The visual verification
  order did not apply: no component, class, token or transition changed.

### Found along the way
- Local Supabase holds no public meditations (every seed row is private), so `/discover`,
  the landing page's latest-meditation block and the sitemap all show their empty states
  locally.
- The Facebook debugger and the real-app share previews are not run yet. They need this
  merged and deployed with `NEXT_PUBLIC_SITE_URL` set in Vercel; the fallback already
  points at production, so they work even before it is set.
