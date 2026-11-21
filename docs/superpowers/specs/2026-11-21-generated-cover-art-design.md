# Generated cover art: design

**Date:** 2026-11-21
**Status:** Draft for approval
**Supersedes the direction in:** `tasks/post-ship/generated-cover-art.md` (generated art
only; custom uploads stay in that task for later)

## Intent

Every meditation gets a realistic cover picture of its own: trees, water, stones, a fawn,
a fairy glade. The operator chose **unique, full-colour images per meditation** (option A
in the brainstorm mockups) over one shared graded look, because a distinct picture is how
a listener recognises a favourite again, the way Insight Timer's list works. The person
making the meditation can describe the cover they want, or let the studio agent choose a
subject from the meditation's mood.

Today every cover is a designed SVG (`src/components/meditation-cover.tsx`): flat tone
fields and a motif derived from the tags and id. Free and on brand, but "Grounding
Stones" and "Night Sky" look alike at a glance.

## Goals

1. A meditation made in the studio has a generated cover within seconds of its first
   script, without being asked.
2. The person can steer it in conversation ("make the cover a misty pine forest") and get
   a new one, up to a cap.
3. The cover shows everywhere the designed cover shows today, at every size, signed in or
   out, with the designed cover as the fallback whenever there is no image.
4. Existing completed meditations (the house meditations on Discover first) get covers
   from a one-off script the operator reviews before anything goes live.

## Non-goals

- **Uploaded custom covers.** Stay in `tasks/post-ship/generated-cover-art.md`; they need
  image moderation first.
- **A shared house grade or style filter.** Option A was chosen; one style line keeps
  prompts photographic and clean, nothing more.
- **Regenerating on script revisions.** A new version keeps its cover unless asked.
- **Per-meditation OG images and Media Session artwork beyond pointing at the cover.**
  Media Session gets the cover URL (cheap); OG images are a later task.
- **Moving the studio agent itself to AI Gateway.** Separate task
  (`tasks/post-ship/ai-gateway.md`); this design only uses the Gateway for images.

## Anti-goals

- A broken-image box anywhere. No image means the designed cover, silently.
- A private meditation's details leaking through its cover (the image prompt is never
  stored on the public row; see Privacy).
- The person's words passed straight to the image model.
- A cover that differs between the owner's view and the public view of the same version.
- Slowing the studio turn: generation must not block the script from appearing.

## Constraints

- **Image model:** `bfl/flux-2-klein-9b` through **Vercel AI Gateway** with the AI SDK's
  `generateImage` (`ai@7`, `@ai-sdk/gateway` is already installed). The operator compared
  real output from four models and chose FLUX 2 Klein. ~2.5s per 1024×1024 image. The
  model id lives in one constant (e.g. `COVER_MODEL` in `src/lib/cover/model.ts`), so a
  move to `bfl/flux-2-pro` or later is a one-line change.
- **Gateway tier:** the operator's Gateway is on the free tier today: Klein is allowed,
  5 image requests per minute per team. Fine at one cover per meditation; the backfill
  script must pace itself. Production auth is Vercel's OIDC token, which deployments get
  automatically; local dev uses `vercel env pull` (`VERCEL_OIDC_TOKEN`, ~12h) or an
  `AI_GATEWAY_API_KEY`. Document both in `.env.example`.
- **Anon reads named columns.** `20261030000058_launch_security.sql` grants `anon` a
  column list on `meditations`, and `discover_meditations` (and `profile_meditations`)
  return explicit columns. A new cover column must be added to the anon grant **and** to
  every function's return list, or signed-out Discover silently shows no covers (only
  production catches a missing grant; see `CLAUDE.md` Conventions).
- **Migrations deploy on merge** (`CLAUDE.md`). The bucket and column land with their PR.
- `generate-audio.ts` and the sandbox snapshot are untouched.
- Design rules: `DESIGN.md` Covers section gets a rewrite for photographic covers; the
  One Gradient Rule and Lightness Rule still hold.

## Approaches considered

1. **A studio tool the agent calls (`makeCover`).** *Chosen.* The agent writes the image
   subject from the meditation's mood right after the first script and details, and again
   whenever the person asks for a different cover. The cover appears on the canvas in
   seconds, before audio. Claude always writes the image prompt, so the person's words
   never reach the image model verbatim, a light judgement layer on top of the provider's
   own safety filter. One mechanism covers both "agent decides" and "person describes".
2. **An automatic step in the audio workflow.** Guaranteed for every completed
   meditation, with workflow retries, but the cover only appears after the 30–60s render,
   steering still needs a studio tool (so two mechanisms), and the workflow package
   carries the deploy gotchas in `CLAUDE.md`. Rejected.
3. Both. Rejected as two mechanisms for one job; the backfill script covers meditations
   that never pass through the studio.

## The design

### Storage and schema

- **Bucket `meditation-covers`**, public read, created by migration (and mirrored in
  `supabase/config.toml`). Objects at **`<meditation_id>/<random>.webp`** (or `.jpg`,
  whichever the provider returns smaller; request WebP/JPEG via provider options if
  supported, else re-encode is left to the builder). *Builder's-check call:* keyed by
  meditation id, never `user_id`: a public cover URL starting with the owner's id would
  let anyone group an author's meditations, which `20261030000058_launch_security.sql`
  and `20261120000000_user_profiles.sql` deliberately prevent. The meditation id is
  already public on public rows.
- **Only the service role writes covers.** *Builder's-check call, following task 58's
  precedent* (spend counters and storage paths are service-role-only; a forged
  `audio_path` once let one user delete another's audio). No storage insert/delete
  policy for `authenticated`; the tool proves ownership by reading the meditation through
  the user's RLS-bound client, then uploads, updates and deletes with the service client.
  *Trade-off accepted:* a private meditation's cover is reachable by anyone holding its
  random URL; the URL is only handed to people who can read the row.
- **`meditations.cover_path text null`**: the object path. Added to the anon column grant
  and to the return lists of `discover_meditations` and `profile_meditations`, and to
  `PUBLIC_COLUMNS` / `ROW_COLUMNS` in `src/lib/meditation/actions.ts` and every other
  read that feeds a cover (`grep -rn "MeditationCover" src`, the bookmarks read, Recently
  played, collections).
- **`meditations.cover_generations smallint not null default 0`**: counts `makeCover`
  calls for the cap. Not in the anon grant, and **not updatable by `authenticated`**
  (neither is `cover_path`): the existing column-level update grant stays as it is, so a
  direct PostgREST PATCH can neither reset the cap nor point `cover_path` at another
  object. The increment is atomic and conditional (an RPC or
  `update … set cover_generations = cover_generations + 1 where id = $1 and
  cover_generations < 3 returning …`), because one model step can call the tool more than
  once in parallel.
- A helper `coverUrl(path: string | null): string | null` builds the public URL.
- Deleting a meditation deletes its cover objects, alongside the audio cleanup in the
  owner-delete path (`src/lib/meditation/delete.ts` or wherever audio objects are
  removed); `src/test/owner-delete.db.test.ts` extended.

### The studio tool

- `makeCover` in `src/lib/chat/tools.ts`, input `{ subject: string }` (one or two
  sentences, max ~300 chars): what the picture shows.
- Requires a linked meditation (after `writeScript`), else an error telling the agent to
  write the script first. Refuses past the cap (**3 per meditation**) with a message the
  agent relays.
- Prompt = `subject` + one shared style line (in `src/lib/cover/prompt.ts`):
  "Full-bleed square photograph filling the whole frame edge to edge. Photographic and
  realistic, natural light, calm, uncluttered composition with one clear subject and room
  to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no
  watermark." *Changed in cover art PR 3:* the line the comparison used opened "Square
  cover image for a guided meditation app.", which FLUX read as an app icon: 7 of 24
  backfill covers came back as a rounded tile on white, whose corners show as white
  slivers in a card. The rest of the line is the comparison's.
  *Changed in the cover styles PR:* the line above is now the `photograph` style, and
  `COVER_STYLES.illustration` adds a second: "Full-bleed square illustration filling the
  whole frame edge to edge. Soft storybook illustration, gentle painterly textures, warm
  calm colours, friendly and simple shapes, one clear subject with room to breathe. No
  rounded corners, no frame, no text, no letters, no logos, no borders, no watermark."
  `makeCover` takes `style` (`photograph` by default); the agent picks `illustration` for
  a children's meditation or when drawn, cartoon or storybook art is asked for. A
  photographic "cartoon dragon" looked like a toy.
- Reads the meditation through the user's client (ownership), reserves a generation with
  the atomic increment, calls `generateImage({ model: gateway.imageModel(COVER_MODEL),
  prompt, aspectRatio: "1:1" })`, uploads with the service client to
  `<meditation_id>/<random>`, sets `cover_path`, then deletes the previous object only if
  its path starts with that meditation's id. Returns `{ coverUrl, remaining }`.
- Failure (provider refusal, rate limit, timeout): returns an error the agent turns into
  one plain sentence; the designed cover stays; the reserved generation is released, so
  a failure does not count against the cap.
- **A missed first cover is caught up.** *Builder's-check call:* if the first cover
  failed, the system prompt tells the agent to try `makeCover` again on its next turn
  (once), and the backfill script is re-runnable for any meditation without a cover, not
  only public ones. Before signups open, the Gateway should move to paid credits so the
  5-per-minute free-tier limit does not drop covers in bursts: an operator item, added to
  `tasks/OPERATOR-TODO.md` and the Phase 6 checklist.
- **System prompt** (`src/lib/ai/`): after the first `writeScript` and `setDetails`, call
  `makeCover` once with a subject drawn from the meditation's mood: one clear natural or
  gently magical subject (water, trees, stones, sky, light, animals, a fairy glade), no
  text, no recognisable real people, nothing the person could not show a stranger. When
  the person asks for a different cover, rewrite their idea as a subject in your own
  words; decline subjects that are sexual, violent, hateful or depict real people. Do not
  call it again on script revisions unless asked.
  *Changed in the cover styles PR:* nature stays the default, but a person is welcome
  when the meditation is about something a person does (a runner at the start line, a
  dancer mid-pose, a monk meditating), shown from behind, in silhouette, at a distance or
  in profile, never a face-on portrait or a recognisable real person. Each adult is named
  with an age range and gender ("a woman in her fifties"), and the adults vary. Subjects
  must be specific and distinctive, not misty forests or golden-hour light (5 of 19
  backfilled covers were one misty forest). No numbers, brands, team kits or signs, and no
  character from a film, book, game, show or brand. Any person in a photograph is an
  adult, never a child, teen, student, girl, boy or kid, never described as young or
  little ("a young ballet dancer" came out as a child); an illustration may show a child,
  and a photograph of a child asked for becomes an illustration. The rules live in `COVER_SUBJECT_RULES` and
  `COVER_STYLE_RULES` (`src/lib/cover/subject.ts`), shared byte for byte by the studio
  prompt and the backfill.
- The canvas shows the cover in its header with a quiet loading state while the tool
  runs; the tool's result updates it without a reload.

### Display

- `MeditationCover` gains `coverUrl?: string | null`. When set, it renders the image
  (square, `object-cover`, same radius and sizes as today, `alt=""` when decorative, the
  title otherwise), via `next/image` with a Supabase Storage `remotePatterns` entry so
  68px thumbnails are not served 1024px files. If the image errors, it falls back to the
  designed SVG. Every call site passes the cover URL from its data.
- **Session player:** the full-bleed background uses the photo with a darker fade than
  the flat designed cover needs (the generated-cover-art task called this out), so the
  title and controls keep contrast in the always-dark player.
- **Media Session:** `artwork` uses the cover URL when present (`use-media-session.ts`).
- Light theme: photos are theme-independent; check that thumbnails sit well on Paper.

### Backfill

- `scripts/backfill-covers.ts`, run by the operator: for completed meditations with no
  cover (public ones by default, `--all` for every meditation without one, `--ids` to
  target; safe to re-run), ask Claude (the studio model) for a
  subject from title, description and tags, generate with `COVER_MODEL`, write the images
  to a local review folder with an HTML contact sheet, and only on `--commit` upload them
  and set `cover_path` with the service role. Paces to the Gateway rate limit.
- *Changed in the cover styles PR:* Claude returns a subject and a style as a structured
  object; `--style` fixes the style for a run, and an answer in the other style is asked
  again for a new subject (then fails for that meditation), never converted, so an
  illustrated child never becomes a photograph. Each request lists the subjects
  already in the manifest (this run's included, the latest 40), declared as data like the
  title, and asks for something clearly different. The manifest records each cover's style (shown on the contact
  sheet) and the SHA-256 of the file a commit stored, so a reviewed image swapped after
  its commit is committed again with `--ids <id> --replace`.
- Operator item: run it against production after the display PR merges, review the
  sheet, then commit.

### Privacy and safety

- The image prompt is not stored on the meditation (the chat already holds the
  conversation, owner-only). Only `cover_path` is public.
- `/privacy`: generated cover images are stored and shown wherever the meditation is.
- Safety layers: Claude writes every prompt; the provider's own filter; the existing
  Report link on public meditations. Uploaded images (avatars, future custom covers) need
  real image moderation, which is a separate task.

## Delivery

Three PRs, in order, each shippable alone:

1. **Storage and display.** Migration (bucket, columns, grants, function return lists),
   `coverUrl`, every read carrying `cover_path`, `MeditationCover` rendering images with
   fallback, `next/image` config, delete cleanup, session player fade, Media Session
   artwork, `DESIGN.md` Covers section. Nothing generates yet, so nothing changes visibly
   until a `cover_path` exists (verify with a hand-set one locally).
2. **The studio tool.** `COVER_MODEL`, prompt helper, `makeCover`, cap, system prompt,
   canvas header, `.env.example`, `/privacy`.
3. **Backfill script** and its operator item; update
   `tasks/post-ship/generated-cover-art.md` to reflect what shipped.

## Left to the builder

- WebP vs JPEG and whether to re-encode; the exact loading state; how the canvas header
  lays out the cover at phone width; the fade values (checked against contrast).
- Whether `remaining` is shown to the person or only told by the agent.
