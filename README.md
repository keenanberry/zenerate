# Zenerate

Describe the meditation you want. Zenerate writes the script, narrates it, and assembles
the audio: pauses, silences, sound effects and all. Live at
[zeneratestudio.com](https://www.zeneratestudio.com).

## How it works

1. **Describe it.** `/create` is a single chat input, the **studio**. You say what you want
   in your own words. A Claude agent (`STUDIO_MODEL`, `claude-sonnet-5-5` in production)
   writes the script through a `writeScript` tool, and it streams into a canvas beside the
   chat. The script is marked up with `*[PAUSE: 5 seconds]*`, `*[SILENCE: 1 minute]*` and
   `*[SOUND: gong-gentle.mp3]*`. The agent also sets the title, description and tags, and
   ends each draft by asking whether you want changes or the audio. Chats are saved and
   private.
2. **Change it by asking.** There's no script editor. You revise in the conversation, and
   every revision is re-checked for length and malformed markup.
3. **Make the audio.** An audio card in the chat picks a narrator from the operator's
   ElevenLabs collection and an ambient bed (rain, ocean, forest, a soft drone, space,
   chanting, or none). Only your click starts a render. A Vercel Workflow spins up a
   Vercel Sandbox from a pre-built snapshot. Inside it, ElevenLabs narrates each spoken
   segment, FFmpeg renders the silences, drops in the sound effects, normalizes the
   narration to -20 LUFS, mixes the ducked ambient bed underneath, and produces one MP3 in
   a private Supabase Storage bucket at `<user_id>/<meditation_id>/<render_id>.mp3`.
4. **Listen, come back, publish.** A waveform player streams it through short-lived signed
   URLs. After listening you can return to the chat, revise, re-render, and keep or replace
   the earlier version. Public meditations appear on `/discover`, with designed covers,
   tags, search, categories, Popular and Picked for you, which anyone can browse without
   an account. The chat and earlier versions are never public.

A meditation's status moves through `script_ready → processing_audio → completed | failed`.
A revision after the audio exists is a draft in the owner-only `meditation_drafts` table
with its own render state, so a public page keeps playing the current version. The free
tier caps audio renders per user per month, sized to the ElevenLabs plan, and caps chat
messages per day. The numbers and the reasoning are in `.env.example`.

`docs/architecture.md` has the pipeline in detail.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Data | Supabase: Postgres with RLS, email/password Auth, Storage |
| Studio agent | AI SDK 7 with `@ai-sdk/anthropic`: a streaming, tool-using chat; the model is set by `STUDIO_MODEL` |
| Narration | ElevenLabs text-to-speech |
| Audio assembly | Vercel Workflow for durable orchestration, Vercel Sandbox for ephemeral FFmpeg compute |
| Player | wavesurfer.js |
| Hosting | Vercel, with a daily cron that keeps the free Supabase project awake |

## Local development

Prerequisites: Node.js 22 or newer, Docker, and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
cp .env.example .env.local      # then fill in the keys below
supabase start                  # local Postgres, Auth and Storage in Docker
supabase db reset               # applies migrations + seed data. LOCAL ONLY: destroys all data
npm run dev
```

> **Never run `supabase db reset` against a linked production project.** It drops all data
> and applies `supabase/seed.sql`, which creates test accounts with a known password.
> Production migrations deploy through the Supabase GitHub integration on merge to `main`;
> if you ever run `supabase db push` by hand, never pass `--include-seed`.

Seeded test accounts: `alice@example.com` and `bob@example.com`, password `password123`.

### Environment variables

`.env.example` is the reference: every variable, its default, and why the default is what
it is. The short version:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything. Printed by `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side storage and status writes. Also from `supabase start` |
| `ANTHROPIC_API_KEY` | The studio agent |
| `STUDIO_MODEL` | Which Claude model the studio uses (default `claude-sonnet-5`; production sets `claude-sonnet-5-5`). Compare with `scripts/measure-studio-rewrites.ts` before changing it |
| `ELEVENLABS_API_KEY` | Narration, and the voice picker |
| `AUDIO_SANDBOX_SNAPSHOT_ID` | Audio generation. Printed by the snapshot build script (below) |
| `VERCEL_OIDC_TOKEN` | Sandbox auth when running audio generation or the snapshot build locally. Vercel injects it in production. Pull it with `vercel env pull` into a scratch file, not `.env.local`, which that command overwrites |
| `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` | Audio quota. The global cap is derived from the ElevenLabs plan |
| `QUOTA_EXEMPT_USER_IDS` | Operator accounts exempt from both audio caps (comma-separated user ids) |
| `NEXT_PUBLIC_SITE_URL` | The canonical site URL for metadata and share cards |
| `PER_USER_DAILY_CHAT_MESSAGES` | Studio chat ceiling (default 200 a day), an abuse guard rather than a product limit |
| `CRON_SECRET`, `KEEPALIVE_PING_URL` | The keepalive cron. The route fails closed without the secret |
| `SOUND_EFFECTS_SUPABASE_URL`, `SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY` | Snapshot build only: the production bucket holding the recorded sound effects |

### Checks

```bash
npm run lint
npx tsc --noEmit
npm test            # vitest
npm run build
```

CI (`.github/workflows/ci.yml`) runs all four on every push to `main` and every pull
request.

## The audio sandbox snapshot

Audio generation runs inside a Vercel Sandbox created from a snapshot that already
contains FFmpeg, the Node dependencies, the compiled `generate-audio.js`, the sound
effects and the ambient beds. **`src/lib/audio/generate-audio.ts`, everything it imports,
`scripts/sound-effects.ts` and `scripts/ambient-beds.ts` are baked into that snapshot.** Editing any of them changes
nothing at runtime until the snapshot is rebuilt and the new ID is deployed. The failure
is silent: tests pass, the edit is in `main`, and production keeps running the old code.

```bash
npx tsx scripts/create-sandbox-snapshot.ts     # prints the new snapshot ID
```

Put the printed ID in `AUDIO_SANDBOX_SNAPSHOT_ID`, both locally and in Vercel, redeploy,
then prove it with `npx tsx scripts/test-audio-generation.ts`. The script header lists
the credentials the build needs. The full loop lives in `.claude/skills/audio-pipeline/`.

Sound effects are catalogued in `src/lib/meditation/sounds.ts` (what the script prompt may
reference) and produced by `scripts/sound-effects.ts` (what the snapshot contains). A test
fails if the two drift. Four are synthesized by FFmpeg at build time; two gongs are CC0
recordings fetched from a private bucket and checksum-verified.

Ambient beds are catalogued in `src/lib/meditation/ambience.ts` and produced by
`scripts/ambient-beds.ts`. Rain, ocean, forest and chant are CC0 recordings under
`scripts/ambient/`, with provenance and checksums; the drone and space beds are
synthesized. Browser previews of every sound and bed live in `public/sounds/` and are
exported by `scripts/export-sound-previews.ts` at the level they're heard in a meditation.

## Scripts

| Script | What it does |
|---|---|
| `scripts/create-sandbox-snapshot.ts` | Builds the sandbox snapshot. Run after any change to the baked-in files |
| `scripts/test-audio-generation.ts` | End-to-end check of a snapshot: generates a short meditation and validates the MP3 |
| `scripts/preview-sound-effects.ts` | Renders the synthesized sound effects locally so you can listen before baking them in |
| `scripts/measure-studio-rewrites.ts` | Runs real studio turns against a chosen model and reports writes per turn, length accuracy, behavior checks and cost. Calls the real model, so it costs money |
| `scripts/measure-script-duration.ts` | Generates scripts at several lengths and reports how close each lands to what was asked. Calls the real model |
| `scripts/export-sound-previews.ts` | Writes the browser previews of the sound effects and ambient beds to `public/sounds/` |
| `scripts/build-icons.ts` | Rebuilds every icon and the OG image from the brand mark |
| `scripts/verify-backup.sh` | Restores a `pg_dump` into a throwaway database and reports what landed |

Each script's header documents its prerequisites.

## Deploying

The app runs on Vercel Hobby with a Supabase Free project. **Migrations deploy through the
Supabase GitHub integration on every push to `main`**, so merging a migration applies it to
production. Anything that must happen first has to happen before the PR merges, and a
migration that new code depends on ships in its own PR ahead of that code. `vercel.json` schedules the daily keepalive ping that stops the free
project from pausing. Backups are a weekly manual `pg_dump`; the procedure, what it does
and does not cover, and how to test a dump are in `docs/runbooks/backup-restore.md`.

## Repository map

| Path | What's there |
|---|---|
| `src/app/` | Routes. `(app)` is the in-app shell, `(app)/(authed)` the signed-in part, `(auth)` login, `(legal)` terms and privacy, `api/` route handlers |
| `src/components/` | UI. `ui/` is shadcn |
| `src/lib/` | `ai/` prompts and the chat ceiling, `chat/` the studio tools and chat persistence, `audio/` the pipeline, `meditation/` parser, types and server actions, `supabase/` client factories, `voices/` the ElevenLabs catalogue |
| `supabase/` | Migrations and local-only seed data |
| `scripts/` | The table above |
| `docs/` | `architecture.md`, `runbooks/`, `handoffs/` (earlier phases' session-to-session state), `superpowers/specs/` (design decisions), `ui-roadmap.md` |
| `tasks/ship/` | The pre-launch checklist, one file per task with acceptance criteria and outcomes |
| `tasks/OPERATOR-TODO.md` | Everything only the operator can do before signups open: phone checks, dashboards, accounts |
| `tasks/post-ship/` | What was deliberately deferred |

## Working on this repo with an agent

`CLAUDE.md` carries the conventions. Two project skills in `.claude/skills/` enforce the
things that go wrong silently: `zenerate-design` for anything a visitor sees, and
`audio-pipeline` for anything the snapshot bakes in. `DESIGN.md` is the design system
contract and `PRODUCT.md` the product record; both are read by the Impeccable design
tooling. To pick up the work, start with `tasks/ship/README.md` (what's done and what's
left), `tasks/OPERATOR-TODO.md`, and the "Next up" section of `tasks/post-ship/README.md`.
`docs/handoffs/` keeps the earlier phases' handoffs as history.
