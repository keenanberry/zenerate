# Zenerate

AI-powered meditation script and audio generation platform.

## Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS v4, shadcn/ui (amethyst-haze theme)
- **Supabase** — Postgres, Auth (email/password), Storage
- **AI SDK 6** — `@ai-sdk/anthropic` for script generation (streaming)
- **Vercel Workflow** + **Vercel Sandbox** — durable orchestration and ephemeral FFmpeg compute
- **ElevenLabs** — text-to-speech
- **wavesurfer.js** — audio player with waveform

See `docs/architecture.md` for how the audio pipeline works end-to-end.

## Worktrees

Orca copies the ignored paths listed in `.worktreeinclude` (`.env.local`, `.vercel`) from
the primary checkout when it creates a worktree, so a new worktree can run immediately.

Two limits: it applies **at creation time only** and does not backfill existing worktrees,
and the copies are **independent** — rotating a key in the primary checkout leaves every
worktree stale. A stale or missing `SUPABASE_SERVICE_ROLE_KEY` surfaces as
`permission denied` or a thrown service-role client, which reads as an application bug
rather than a configuration one. Resync worktrees after rotating a secret.

## Local Dev

```bash
npm install
cp .env.example .env.local    # fill in keys
supabase start                # requires Docker
supabase db reset             # applies migrations + seed data — LOCAL ONLY, destroys all data
npm run dev
```

> **Never run `supabase db reset` against a linked production project.** It drops all data and applies `supabase/seed.sql`, which creates test accounts with a known password. Production migrations go out with `supabase db push`, which applies migrations only by default — never pass `--include-seed` against a linked production project, or it will apply this same file.

Seeded test users: `alice@example.com` / `bob@example.com` — password `password123`.

## Where Things Live

| Path | Purpose |
|---|---|
| `src/app/(app)/` | In-app routes. `discover`, `meditation/[id]` are public; `(authed)/` holds dashboard, create, collections/[id] |
| `src/app/(auth)/` | Login + auth callbacks |
| `src/app/api/generate/` | Script generation endpoint (streams from Anthropic) |
| `src/app/api/audio/generate/` | Audio pipeline trigger — validates, kicks off workflow |
| `src/app/proxy.ts` | Supabase session refresh |
| `src/lib/audio/` | Audio pipeline — `workflow.ts`, `generate-audio.ts`, `storage.ts` |
| `src/lib/meditation/` | Parser, types, server actions |
| `src/lib/ai/` | LLM prompt + script generation logic |
| `src/lib/supabase/` | Client factories (server, browser, service-role) |
| `src/components/` | UI components |
| `supabase/migrations/` | SQL migrations |
| `supabase/seed.sql` | Seed data (test users, meditations, collections) |
| `scripts/` | Snapshot builder, audio integration test |

## Conventions

- **Route groups** — `(app)` renders for anyone; `(app)/(authed)` redirects signed-out visitors, and its `layout.tsx` is the only auth gate. A page signed-out visitors can reach reads as the `anon` role, which needs a table `GRANT` as well as an RLS policy — local grants `anon` everything, so only production catches a missing one.
- **Server actions** live in `src/lib/*/actions.ts`, called from client components for mutations.
- **Status state machine** — meditations move `generating_script` → `script_ready` → `processing_audio` → `completed` / `failed`. `audio-section.tsx` switches UI on this.
- **Public vs private** — `meditations.is_public` + RLS policies enforce visibility.
- **Supabase clients** — use `createClient()` from the right factory: `server.ts` in server components / route handlers, `browser.ts` in client components, `service-role.ts` only in trusted server code that needs to bypass RLS.

## Sandbox Snapshot — Critical Gotcha

`src/lib/audio/generate-audio.ts` **and everything it imports** (currently `loudness.ts`) are **baked into the sandbox snapshot**, as are the sound effects in `scripts/sound-effects.ts`. Any edit to either requires rebuilding:

```bash
npx tsx scripts/create-sandbox-snapshot.ts
# copy the printed snapshot ID into AUDIO_SANDBOX_SNAPSHOT_ID, locally and in Vercel, then redeploy
```

Without a rebuild, changes have zero effect on what actually runs. The build needs a `VERCEL_OIDC_TOKEN` and production `SOUND_EFFECTS_SUPABASE_*` credentials; the script header says how to get both without overwriting `.env.local`. `scripts/test-audio-generation.ts` checks a snapshot end to end.

A new sound goes in `src/lib/meditation/sounds.ts` (what the prompt offers) and `scripts/sound-effects.ts` (what the build produces); a test fails if they drift.

## Pre-Ship Work

Tracked in `tasks/ship/` — see `tasks/ship/README.md` for the full checklist.
Post-ship ideas live in `tasks/post-ship/`.
