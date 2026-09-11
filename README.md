# Zenerate

AI-powered meditation script and audio generation platform built with Next.js, Supabase, and Vercel.

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for Supabase local development)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in API keys (see Environment Variables below)

# Start Supabase (requires Docker)
supabase start

# Reset DB with seed data — LOCAL ONLY, destroys all data
supabase db reset

# Start the dev server
npm run dev
```

> **Never run `supabase db reset` against a linked production project.** It drops all data and applies `supabase/seed.sql`, which creates test accounts with a known password. Production migrations go out with `supabase db push`, which never runs seeds.

Sign in with a test account: `alice@example.com` / `password123`

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL (from `supabase start`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (from `supabase start`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (from `supabase start`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for meditation script generation |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for text-to-speech |
| `AUDIO_SANDBOX_SNAPSHOT_ID` | Vercel Sandbox snapshot ID (from snapshot builder) |
| `VERCEL_TOKEN` | Vercel access token for Sandbox auth |
| `VERCEL_TEAM_ID` | Vercel team ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## Architecture

### Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- **Supabase** — PostgreSQL, Auth, Storage
- **AI SDK 6** — `@ai-sdk/anthropic` for meditation script generation
- **Vercel Workflow** — durable multi-step orchestration for audio pipeline
- **Vercel Sandbox** — ephemeral microVMs for FFmpeg audio processing
- **ElevenLabs** — text-to-speech API

### Audio Generation Pipeline

The audio pipeline converts meditation scripts (with markup like `*[PAUSE: 5 seconds]*` and `*[SILENCE: 1 minute]*`) into MP3 files:

```
POST /api/audio/generate
  → Vercel Workflow (durable orchestration)
    → Step 1: Fetch meditation script from DB, parse segments
    → Step 2: Spin up Vercel Sandbox from snapshot
      → generate-audio.js runs inside the VM:
        - ElevenLabs TTS for speech segments
        - FFmpeg silence generation for pause/silence segments
        - FFmpeg concatenation of all segments into final MP3
      → Download output.mp3 + result.json from sandbox
      → Upload MP3 to Supabase Storage
    → Step 3: Update meditation status to "completed" with audio URL and generation metadata
```

Key files:

| File | Purpose |
|---|---|
| `src/app/api/audio/generate/route.ts` | API endpoint — validates auth/ownership, triggers workflow |
| `src/lib/audio/workflow.ts` | Vercel Workflow — orchestrates the full pipeline |
| `src/lib/audio/generate-audio.ts` | Standalone script that runs inside the sandbox |
| `src/lib/audio/storage.ts` | Supabase Storage upload + DB status updates |
| `src/lib/meditation/parser.ts` | Parses script markup into typed segments |
| `src/lib/meditation/types.ts` | TypeScript types for meditations, segments, generation metadata |

### Cost Tracking

Each audio generation records metadata in the `generation_meta` JSONB column:

- `tts_characters` — total characters sent to ElevenLabs (maps to billing)
- `tts_requests` — number of TTS API calls
- `processing_time_ms` — total sandbox processing time
- `generated_at` — ISO timestamp

## Scripts

### Build Sandbox Snapshot

Creates a Vercel Sandbox snapshot pre-loaded with FFmpeg, Node dependencies, and the compiled `generate-audio.js` script. The snapshot is permanent (`expiration: 0`) so it won't expire.

```bash
npx tsx scripts/create-sandbox-snapshot.ts
```

After running, copy the printed snapshot ID into `.env.local`:

```
AUDIO_SANDBOX_SNAPSHOT_ID=<snapshot_id>
```

**When to rebuild:** any time `src/lib/audio/generate-audio.ts` changes, since it's baked into the snapshot.

### Test Audio Generation

Runs an integration test that spins up a sandbox, generates audio from a minimal meditation script (~50 characters), and validates the output.

```bash
npx tsx scripts/test-audio-generation.ts
```

Output is saved to `test-output/test-meditation.mp3` for manual listening.

### Manage Snapshots

List all snapshots for your project:

```bash
npx sandbox snapshots list
```

Delete old snapshots you no longer need:

```bash
# Single snapshot
npx sandbox snapshots delete <snapshot_id>

# Multiple at once
npx sandbox snapshots delete <snapshot_id_1> <snapshot_id_2>
```

## Development

### Database Migrations

Migrations live in `supabase/migrations/`. Apply them with:

```bash
supabase db reset    # resets and re-applies all migrations + seed data — LOCAL ONLY, destroys all data
```

### Project Status

See `docs/project-status.md` for a detailed breakdown of what's built and what's next.
