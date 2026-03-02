# Zenerate — Project Status

## What's Built

### Infrastructure
- **Next.js 16** with App Router, TypeScript, Tailwind CSS v4, and shadcn/ui (amethyst-haze theme)
- **Supabase** running locally via CLI — PostgreSQL with 4 tables, RLS policies, and seed data
- **AI SDK 6** with `@ai-sdk/anthropic` for meditation script generation
- **Auth** via `@supabase/ssr` with email/password, session refresh in `proxy.ts`, route protection in server layout
- **Dark mode** via `next-themes` with system preference detection and manual toggle
- **Vercel Workflow** (`workflow` package) for durable, multi-step orchestration
- **Vercel Sandbox** (`@vercel/sandbox`) for ephemeral FFmpeg compute in isolated microVMs

### Database (4 tables)
- `meditations` — core content with title, prompt, generated script, audio_url, status, public/private toggle
- `collections` — user-created playlists/groups
- `collection_items` — join table linking meditations to collections with ordering
- `favorites` — quick-save relationship between users and meditations

### Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, features, and CTA |
| `/login` | Email/password auth (sign in + sign up toggle) |
| `/dashboard` | Tabbed library: My Meditations (with favorites), Favorites, Collections |
| `/create` | Multi-step creation wizard with templates, AI generation, inline editing |
| `/discover` | Community feed of public meditations with search |
| `/meditation/[id]` | Detail page: script viewer, visibility toggle, favorite, add-to-collection |
| `/collections/[id]` | Collection detail with ordered meditation list |

### Key Features
- **Dark mode toggle** in nav and landing page header (sun/moon icon, persists preference)
- **Multi-step creation wizard** — 4 steps: Type & Duration → Intention & Preferences → Generate & Preview → Save & Configure
- **Template presets** — 8 quick-start templates (Morning Calm, Sleep Wind-Down, Focus Session, Stress Relief, Gratitude, Body Scan, Breathwork, Visualization)
- **Inline script editor** — split view (raw markup + rendered preview) on desktop, tabbed on mobile
- **Script viewer** — parsed markup rendering with color-coded segments (speech, pause, silence, sound)
- **Favorites** — optimistic heart toggle, visible across dashboard and discover
- **Collections** — add-to-collection dialog, ordered track list, remove items
- **Responsive design** — mobile-friendly nav (icon-only on small screens), responsive grids and form layouts
- **Track list view** — Spotify-style list with index, type badge, duration, date; grid/list toggle

### AI Generation
- System prompt instructs Claude to output meditation scripts with `*[PAUSE]*`, `*[SILENCE]*`, and `*[SOUND]*` markup
- Streams in real-time via `useCompletion` + API route at `/api/generate`
- Parser converts markup into typed segments for rendering

### Audio Generation Pipeline (backend complete, not yet wired to UI)
- **API route** at `/api/audio/generate` — authenticated POST endpoint that validates ownership, checks status is `script_ready`, and triggers a Vercel Workflow
- **Vercel Workflow** orchestrates the pipeline: fetch meditation → parse segments → create sandbox → generate audio → upload to storage → update DB status
- **Vercel Sandbox** runs audio processing in an isolated microVM from a pre-built snapshot containing FFmpeg, `fluent-ffmpeg`, and the `@elevenlabs/elevenlabs-js` SDK
- **generate-audio.js** — standalone script baked into the sandbox snapshot that processes each segment: ElevenLabs TTS for speech, FFmpeg for silence/pauses, concatenation, and optional background music mixing with volume ducking
- **Supabase Storage** bucket (`meditation-audio`) for final MP3 files with signed URLs for playback
- **Snapshot builder** at `scripts/create-sandbox-snapshot.ts` — compiles the generation script, installs FFmpeg + Node deps, and creates a permanent snapshot (`expiration: 0`)
- Status tracking: `generating_script` → `script_ready` → `processing_audio` → `completed` / `failed`

### Seed Data
- 2 test users (alice@example.com, bob@example.com — password: `password123`)
- 7 meditations across types: guided, body scan, breathwork, sleep, loving kindness, mindfulness, visualization
- 3 collections and cross-user favorites

---

## What's Next

### Audio Generation — Remaining Setup
The backend pipeline is built but requires a few manual steps before first use:

1. **ElevenLabs API key** — sign up and add `ELEVENLABS_API_KEY` to `.env.local`
2. **Vercel project** — run `vercel link` to connect the project (one-time)
3. **Sandbox auth** — set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` in `.env.local` (access token approach for stable local dev)
4. **Build snapshot** — run `npx tsx scripts/create-sandbox-snapshot.ts` and copy the snapshot ID into `AUDIO_SANDBOX_SNAPSHOT_ID`
5. **Apply migration** — run `supabase db reset` to add the `audio_url` column and `meditation-audio` storage bucket

### Audio Generation UX
The bridge between script creation and audio output — needs design:
- After saving a script, how does the user trigger audio generation?
- Voice selection flow: preview/audition voices before committing
- Background music and sound effect options
- Progress indication during the multi-step audio pipeline
- Preview and re-generate before finalizing

### Audio Player
- Replace the stubbed placeholder with a real player
- Play/pause, seek, progress bar, volume control
- Stream from Supabase Storage signed URLs

### Sound Effects Library
- Source real audio files (gong, bells, chimes, singing bowls) from Freesound.org, Zapsplat, or BBC Sound Effects
- Bundle into the sandbox snapshot (rebuild with `scripts/create-sandbox-snapshot.ts`)
- Currently `SOUND` segments fall back to 1s silence if the file is not found

### Additional Features (Future)
- Voice selection UI (multiple ElevenLabs voices with preview)
- Background music library (ambient, nature, singing bowls)
- Binaural beats / frequency options
- Real-time audio preview during generation
- Public collection sharing
- User profiles and follow system

---

## Running Locally

```bash
# Start Supabase (requires Docker)
supabase start

# Reset DB with seed data
supabase db reset

# Start the app
npm run dev

# Sign in with: alice@example.com / password123
```

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
ANTHROPIC_API_KEY=<your key>
ELEVENLABS_API_KEY=<your key>
AUDIO_SANDBOX_SNAPSHOT_ID=<from scripts/create-sandbox-snapshot.ts>

# Vercel Sandbox auth (access token approach for local dev)
VERCEL_TOKEN=<your access token>
VERCEL_TEAM_ID=<your team id>
VERCEL_PROJECT_ID=<your project id>
```
