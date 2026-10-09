# Zenerate

Describe the meditation you want. Zenerate writes the script, narrates it, and assembles
the audio: pauses, silences, sound effects and all. Live at
[zeneratestudio.com](https://www.zeneratestudio.com).

## How it works

1. **Script.** You describe a meditation (type, length, focus). Claude streams back a
   script marked up with `*[PAUSE: 5 seconds]*`, `*[SILENCE: 1 minute]*` and
   `*[SOUND: gong-gentle.mp3]*`. You can edit it before going further.
2. **Voice.** Pick a narrator from the operator's ElevenLabs collection.
3. **Audio.** A Vercel Workflow spins up a Vercel Sandbox from a pre-built snapshot.
   Inside it, ElevenLabs narrates each spoken segment, FFmpeg renders the silences, drops in
   the sound effects, normalizes the narration to -20 LUFS, and concatenates the result into
   one MP3, which lands in a private Supabase Storage bucket.
4. **Listen.** A waveform player streams it through short-lived signed URLs. Signed-in
   users can download it, favourite it, file it into collections, and publish it to
   `/discover`, which anyone can browse without an account.

Meditations move through `generating_script → script_ready → processing_audio →
completed | failed`. The free tier caps audio generation per user per month, sized to the
ElevenLabs plan; the numbers and the reasoning are in `.env.example`.

`docs/architecture.md` has the pipeline in detail.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Data | Supabase: Postgres with RLS, email/password Auth, Storage |
| Script generation | AI SDK 6 with `@ai-sdk/anthropic`, streaming |
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
> Production migrations go out with `supabase db push`, which applies migrations only by
> default. Never pass `--include-seed` against a linked production project.

Seeded test accounts: `alice@example.com` and `bob@example.com`, password `password123`.

### Environment variables

`.env.example` is the reference: every variable, its default, and why the default is what
it is. The short version:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything. Printed by `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side storage and status writes. Also from `supabase start` |
| `ANTHROPIC_API_KEY` | Script generation |
| `ELEVENLABS_API_KEY` | Narration, and the voice picker |
| `AUDIO_SANDBOX_SNAPSHOT_ID` | Audio generation. Printed by the snapshot build script (below) |
| `VERCEL_OIDC_TOKEN` | Sandbox auth when running audio generation or the snapshot build locally. Vercel injects it in production. Pull it with `vercel env pull` into a scratch file, not `.env.local`, which that command overwrites |
| `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` | Audio quota. The global cap is derived from the ElevenLabs plan |
| `PER_USER_MONTHLY_SCRIPT_LIMIT`, `MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS` | Script quota, an abuse guard rather than a product limit |
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
contains FFmpeg, the Node dependencies, the compiled `generate-audio.js` and the sound
effects. **`src/lib/audio/generate-audio.ts`, everything it imports, and
`scripts/sound-effects.ts` are baked into that snapshot.** Editing any of them changes
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

## Scripts

| Script | What it does |
|---|---|
| `scripts/create-sandbox-snapshot.ts` | Builds the sandbox snapshot. Run after any change to the baked-in files |
| `scripts/test-audio-generation.ts` | End-to-end check of a snapshot: generates a short meditation and validates the MP3 |
| `scripts/preview-sound-effects.ts` | Renders the synthesized sound effects locally so you can listen before baking them in |
| `scripts/measure-script-duration.ts` | Generates scripts at several lengths and reports how close each lands to what was asked. Calls the real model |
| `scripts/test-generation-quota.ts` | Manual check of the quota logic against local Supabase |
| `scripts/verify-backup.sh` | Restores a `pg_dump` into a throwaway database and reports what landed |

Each script's header documents its prerequisites.

## Deploying

The app runs on Vercel Hobby with a Supabase Free project. Migrations go out with
`supabase db push`. `vercel.json` schedules the daily keepalive ping that stops the free
project from pausing. Backups are a weekly manual `pg_dump`; the procedure, what it does
and does not cover, and how to test a dump are in `docs/runbooks/backup-restore.md`.

## Repository map

| Path | What's there |
|---|---|
| `src/app/` | Routes. `(app)` is the in-app shell, `(app)/(authed)` the signed-in part, `(auth)` login, `(legal)` terms and privacy, `api/` route handlers |
| `src/components/` | UI. `ui/` is shadcn |
| `src/lib/` | `ai/` prompts and script quota, `audio/` the pipeline, `meditation/` parser, types and server actions, `supabase/` client factories, `voices/` the ElevenLabs catalogue |
| `supabase/` | Migrations and local-only seed data |
| `scripts/` | The table above |
| `docs/` | `architecture.md`, `runbooks/`, `handoffs/` (session-to-session state), `superpowers/specs/` (design decisions), `ui-roadmap.md` |
| `tasks/ship/` | The pre-launch checklist, one file per task with acceptance criteria and outcomes |
| `tasks/post-ship/` | What was deliberately deferred |

## Working on this repo with an agent

`CLAUDE.md` carries the conventions. Two project skills in `.claude/skills/` enforce the
things that go wrong silently: `zenerate-design` for anything a visitor sees, and
`audio-pipeline` for anything the snapshot bakes in. `DESIGN.md` is the design system
contract and `PRODUCT.md` the product record; both are read by the Impeccable design
tooling. Each phase of work ends with a handoff in `docs/handoffs/`; start there.
