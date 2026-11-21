# Generated Cover Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every studio meditation gets a unique, realistic generated cover (FLUX 2 Klein through Vercel AI Gateway) that shows everywhere the designed cover does, with the designed cover as fallback.

**Architecture:** Three PRs, each branched from `main` after the previous merges. PR 1 adds storage, schema, grants and display (nothing generates yet). PR 2 adds the `makeCover` studio tool, its cap and the system prompt. PR 3 adds the reviewed backfill script.

**Tech Stack:** Next.js 16, Supabase (Postgres, Storage, RLS, column grants), AI SDK 7 `generateImage` + `@ai-sdk/gateway`, Vitest (node env; `*.db.test.ts` opt-in DB tests with `SUPABASE_DB_TESTS=1`).

**Spec:** `docs/superpowers/specs/2026-11-21-generated-cover-art-design.md` — read it in full first; it holds the reasons and the builder's-check calls this plan implements.

## Global Constraints

- Image model: `bfl/flux-2-klein-9b`, in one constant `COVER_MODEL` (`src/lib/cover/model.ts`).
- Bucket `meditation-covers`, public read; object paths `<meditation_id>/<random>.<ext>`; **never** a `user_id` in the path.
- Only the **service role** writes cover objects, `cover_path` and `cover_generations`. No storage insert/delete policy for `authenticated`; no update grant on those columns for `authenticated`.
- `cover_path` must be added to the `anon` column grant on `meditations` **and** to the return lists of `discover_meditations` and `profile_meditations` (see `supabase/migrations/20261030000058_launch_security.sql`, `20261120000000_user_profiles.sql`). `cover_generations` is not granted to `anon`.
- Cap: **3** `makeCover` generations per meditation; a failed generation does not count.
- Style line (exact): "Square cover image for a guided meditation app. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No text, no letters, no logos, no borders, no watermark."
- Migrations deploy to production on merge. Additive only; no destructive statements.
- Visible changes follow the `zenerate-design` skill's verification order; list what was checked in each PR body.
- CI: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. Revert any `package-lock.json` change.
- Local Gateway auth: `vercel -Q "$HOME/.vercel-personal" env pull <file> --environment development --yes` gives `VERCEL_OIDC_TOKEN`; never overwrite `.env.local` with it (pull to a separate file and source it).

## Review Focus

1. **Signed-out Discover shows covers.** A missing anon grant or function column shows designed covers to signed-out visitors only, and only production catches it. Pinned in Task 1.1 by a DB test reading a public meditation's `cover_path` as `anon` directly and through `discover_meditations`.
2. **No one can forge a cover.** A direct PostgREST PATCH by the owner of `cover_path` or `cover_generations` must be refused, and the tool must never delete an object outside the meditation's own prefix. Pinned in Task 1.1 (DB test) and Task 2.2 (`isOwnCoverPath` tests).
3. **Parallel calls respect the cap.** Two `makeCover` calls in one model step must not both pass at 2/3. Pinned in Task 2.2 by a DB test of the atomic reserve.
4. **A broken image never shows.** An image URL that 404s or errors falls back to the designed SVG. Pinned in Task 1.3 by a render test of the fallback branch and a manual check.
5. **Deleting a meditation removes its covers.** Pinned in Task 1.1 by extending `src/test/owner-delete.db.test.ts`.

---

## PR 1 — Storage and display

Branch from `main`. Title: "Store and show generated meditation covers (cover art PR 1)".

### Task 1.1: Migration, grants, delete cleanup

**Files:** Create `supabase/migrations/<ts>_meditation_covers.sql`, `src/test/meditation-covers.db.test.ts`; modify `supabase/config.toml`, `src/lib/meditation/delete.ts`, `src/test/owner-delete.db.test.ts`.

**Interfaces:** Produces columns `meditations.cover_path text null`, `meditations.cover_generations smallint not null default 0 check (cover_generations between 0 and 3)`; bucket `meditation-covers` (public, ~2 MB limit, `image/webp`, `image/jpeg`, `image/png`); function return lists including `cover_path`.

- [ ] **Step 1: Write the failing DB tests:** as `anon`, selecting `cover_path` of a public meditation succeeds and `discover_meditations()` rows carry `cover_path`; as `anon`, selecting `cover_generations` fails; as the owner (`authenticated`), `update meditations set cover_path = 'x'` and `set cover_generations = 0` are refused; as `authenticated`, uploading to `meditation-covers` is refused; owner-delete removes the meditation's cover objects.
- [ ] **Step 2: Run** `SUPABASE_DB_TESTS=1 npx vitest run src/test/meditation-covers.db.test.ts` — FAIL.
- [ ] **Step 3: Write the migration:** columns; bucket insert `on conflict do nothing`; extend the anon `grant select (…)` with `cover_path`; recreate `discover_meditations` and `profile_meditations` with `cover_path` added to their return lists (same bodies, filters and grants otherwise; copy from the latest migration defining each). Mirror the bucket in `config.toml`. In `delete.ts`, after the row delete, remove every object under `<meditation_id>/` in `meditation-covers` with the service client (list then remove), alongside the audio cleanup.
- [ ] **Step 4: Apply locally** (`supabase migration up`; local only) and run the DB tests — PASS. **Commit.**

### Task 1.2: Reads carry the cover URL

**Files:** Create `src/lib/cover/url.ts` + `url.test.ts`; modify `src/lib/meditation/actions.ts` (`PUBLIC_COLUMNS`, `ROW_COLUMNS`, hydration), `src/lib/meditation/types.ts`, `src/lib/meditation/bookmarks.ts`, `src/lib/meditation/library.ts`, and any other read that feeds `MeditationCover` (`grep -rn "MeditationCover" src` and follow each call site's data to its query).

**Interfaces:** Produces `coverUrl(path: string | null | undefined): string | null` (public URL from `NEXT_PUBLIC_SUPABASE_URL` + `/storage/v1/object/public/meditation-covers/` + path; null for empty), and `cover_url: string | null` on `MeditationWithMeta` and on every narrower row type a cover is drawn from.

- [ ] **Step 1: Failing tests** for `coverUrl`: `null` → `null`; `"m1/a.webp"` → `` `${base}/storage/v1/object/public/meditation-covers/m1/a.webp` ``; a path with spaces is URL-encoded per segment.
- [ ] **Step 2:** Implement; add `cover_path` to the selects and `cover_url` to hydration. **Step 3:** `npm test && npx tsc --noEmit` — PASS. **Commit.**

### Task 1.3: `MeditationCover` renders the image

**Files:** Modify `src/components/meditation-cover.tsx` (+ test), `next.config.ts` (`images.remotePatterns` for the Supabase Storage host, from `NEXT_PUBLIC_SUPABASE_URL`), every `MeditationCover` call site (pass `coverUrl`), `src/components/session-player.tsx` (full-bleed photo with a darker fade), `src/components/use-media-session.ts` (artwork from the cover when present), `DESIGN.md` (Covers section: photographic covers, fallback rule, the session-player fade).

**Interfaces:** `MeditationCover` gains `coverUrl?: string | null`. When set: `next/image` filling the same square (or `crop` box), `object-cover`, same radius, `sizes` matching the rendered size, `alt` = `""` when `decorative` else the title; on `onError`, switch to the designed SVG for that mount. When unset: today's SVG unchanged.

- [ ] **Step 1: Failing test:** with `coverUrl`, markup contains an `<img` with the URL (Next image `src` encodes it) and no `data-motif`; without it, markup is unchanged from today (snapshot of an existing case); the error-fallback state renders the SVG (test the fallback by rendering the component's internal fallback branch, e.g. an exported `CoverImage` with `failed`).
- [ ] **Step 2:** Implement and thread `coverUrl` through every call site. **Step 3:** Verify by hand with a cover set locally (upload any square image to the local bucket at `<id>/test.webp` and set `cover_path` with SQL): Discover rows and carousels, Library rows and Recently played, collections, the meditation page, the session player (contrast of title/controls over the photo), the canvas, dark and light, desktop and 390px; then set a bad path and confirm the designed cover shows. **Commit.**

### Task 1.4: PR

- [ ] Lint, tsc, test, build; `impeccable detect` once on changed UI files; open the PR (body: verification, and **merging deploys the migration**); wait for CI green.

---

## PR 2 — The studio tool

Branch from `main` after PR 1 merges. Title: "Let the studio agent make a cover for each meditation (cover art PR 2)".

### Task 2.1: Model, prompt, generation

**Files:** Create `src/lib/cover/model.ts`, `src/lib/cover/prompt.ts` + test, `src/lib/cover/generate.ts`; modify `.env.example` (Gateway auth notes).

**Interfaces:** `COVER_MODEL = "bfl/flux-2-klein-9b"`; `COVER_STYLE` (exact line above); `coverPrompt(subject: string): string` → trimmed subject + `" "` + `COVER_STYLE`, subject capped at 300 chars; `generateCover(subject: string): Promise<{ bytes: Uint8Array; mediaType: string }>` calling `generateImage({ model: gateway.imageModel(COVER_MODEL), prompt: coverPrompt(subject), aspectRatio: "1:1" })` (request WebP/JPEG through provider options if BFL supports it; otherwise keep PNG), with a 30s abort.

- [ ] Tests for `coverPrompt` (trims, caps at 300, appends the style exactly). Implement. **Commit.**

### Task 2.2: Reserve, store, the tool

**Files:** Create `supabase/migrations/<ts>_cover_generation_rpc.sql`, `src/lib/cover/store.ts` + test, `src/test/cover-reserve.db.test.ts`; modify `src/lib/chat/tools.ts` (+ `tools.test.ts`).

**Interfaces:**
- SQL `reserve_cover_generation(p_meditation uuid) returns int` (security definer, `service_role` only): `update meditations set cover_generations = cover_generations + 1 where id = p_meditation and cover_generations < 3 returning cover_generations`; null when at the cap. `release_cover_generation(p_meditation uuid)`: decrement, floored at 0.
- `isOwnCoverPath(path: string | null, meditationId: string): boolean` — true only for `<meditationId>/<file>` with no further segments.
- `storeCover(meditationId: string, image: { bytes; mediaType }): Promise<{ path: string; url: string }>` — service client upload to `<meditationId>/<random>.<ext>`, update `cover_path`, then delete the previous object when `isOwnCoverPath(previous, meditationId)`.
- Tool `makeCover`, input `{ subject: z.string().min(3).max(300) }`. Steps: linked meditation via the user's client (else "There is no script yet. Call writeScript first."); `reserve` (null → "This meditation has had its 3 covers. Tell the person, and offer to keep one of the earlier ideas."); `generateCover`; `storeCover`; return `{ coverUrl, remaining: 3 - n }`. On any failure after reserving, `release` and throw a short message the agent can relay.

- [ ] **Step 1: Failing tests:** `isOwnCoverPath` (own path true; other meditation, nested, empty, null, `../` false); DB test: with `cover_generations = 2`, two concurrent `reserve` calls → exactly one returns 3 and one null; `release` floors at 0. Tool test with `generateCover`/`storeCover` mocked: no meditation → error; at cap → error text; success → `{ coverUrl, remaining }`; generation throws → `release` called.
- [ ] **Step 2:** Implement. **Step 3:** Tests pass. **Commit.**

### Task 2.3: System prompt and canvas

**Files:** Modify `src/lib/ai/prompts.ts` (`STUDIO_SYSTEM_PROMPT`), the studio canvas header (`src/components/studio/script-canvas.tsx` / `studio-context.tsx`) and tool-part rendering (`src/components/studio/parts.tsx`), `src/app/(legal)/privacy/page.tsx`, `tasks/OPERATOR-TODO.md`, `tasks/post-ship/generated-cover-art.md`.

- [ ] Prompt rules (add to the tool guidance, in the prompt's own voice): after the first `writeScript` and `setDetails`, call `makeCover` once with a subject drawn from the meditation's mood — one clear natural or gently magical subject, no text, no recognisable real people, nothing you could not show a stranger; when the person asks for a different cover, rewrite their idea as a subject in your own words and decline sexual, violent, hateful or real-person subjects; if a cover failed, try once more on your next turn; do not remake it on script revisions unless asked; never tell the person a cover exists before the tool returns.
- [ ] Canvas: the cover (or designed fallback) in the canvas header; a quiet loading state while a `makeCover` part is in flight; the tool result updates it without a reload. Verify at 390px and desktop, dark and light, with a real generation locally (Gateway token per Global Constraints).
- [ ] `/privacy`: generated cover images are stored and shown wherever the meditation is. `OPERATOR-TODO`: move the Gateway to paid credits before signups open (free tier is 5 image requests/minute and $5/month); after merge, make a meditation on the phone and see its cover. **Commit; open the PR; CI green.**

---

## PR 3 — Backfill

Branch from `main` after PR 2 merges. Title: "Add a reviewed backfill for meditation covers (cover art PR 3)".

### Task 3.1: The script

**Files:** Create `scripts/backfill-covers.ts` (+ a test for its pure parts), modify `tasks/OPERATOR-TODO.md`, `tasks/post-ship/generated-cover-art.md`.

**Interfaces:** CLI: `npx tsx scripts/backfill-covers.ts [--all] [--ids a,b] [--out dir] [--commit]`. Default selects completed public meditations with `cover_path is null`; `--all` drops the public filter; `--ids` targets. Without `--commit`: asks the studio model (`STUDIO_MODEL`, `@ai-sdk/anthropic`) for a subject from title, description and tags under the same rules as the system prompt, calls `generateCover`, writes `<out>/<id>.<ext>` and `<out>/index.html` (a contact sheet: cover, title, subject). With `--commit`: uploads the reviewed files from `<out>` with `storeCover` (does not regenerate). Paces generation to at most 5 per minute; resumable (skips ids already in `<out>`).

- [ ] Tests for argument parsing and the pacing helper. Implement. Run locally against seed data without `--commit`, open the sheet, then `--commit` locally and see covers on Discover. Operator item: the same against production. **Commit; open the PR; CI green.**
