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

## Local Dev

```bash
npm install
cp .env.example .env.local    # fill in keys
supabase start                # requires Docker
supabase db reset             # applies migrations + seed data — LOCAL ONLY, destroys all data
npm run dev
```

> **Never run `supabase db reset` against a linked production project.** It drops all data and applies `supabase/seed.sql`, which creates test accounts with a known password. Production migrations go out with `supabase db push`, which never runs seeds.

Seeded test users: `alice@example.com` / `bob@example.com` — password `password123`.

## Where Things Live

| Path | Purpose |
|---|---|
| `src/app/(app)/` | Authed routes — dashboard, create, discover, meditation/[id], collections/[id] |
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

- **Route groups** — `(app)` is authed, `(auth)` is public. Auth gating happens in `src/app/(app)/layout.tsx`.
- **Server actions** live in `src/lib/*/actions.ts`, called from client components for mutations.
- **Status state machine** — meditations move `generating_script` → `script_ready` → `processing_audio` → `completed` / `failed`. `audio-section.tsx` switches UI on this.
- **Public vs private** — `meditations.is_public` + RLS policies enforce visibility.
- **Supabase clients** — use `createClient()` from the right factory: `server.ts` in server components / route handlers, `browser.ts` in client components, `service-role.ts` only in trusted server code that needs to bypass RLS.

## Sandbox Snapshot — Critical Gotcha

`src/lib/audio/generate-audio.ts` is **baked into the sandbox snapshot**. Any edit requires rebuilding:

```bash
npx tsx scripts/create-sandbox-snapshot.ts
# copy the printed snapshot ID into AUDIO_SANDBOX_SNAPSHOT_ID
```

Without a rebuild, changes to that file have zero effect on what actually runs. Same applies when bundling new sound effect files into the snapshot.

## Pre-Ship Work

Tracked in `tasks/ship/` — see `tasks/ship/README.md` for the full checklist.
Post-ship ideas live in `tasks/post-ship/`.
