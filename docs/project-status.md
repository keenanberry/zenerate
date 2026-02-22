# Zenerate — Project Status

## What's Built

### Infrastructure
- **Next.js 16** with App Router, TypeScript, Tailwind CSS v4, and shadcn/ui (amethyst-haze theme)
- **Supabase** running locally via CLI — PostgreSQL with 4 tables, RLS policies, and seed data
- **AI SDK 6** with `@ai-sdk/anthropic` for meditation script generation
- **Auth** via `@supabase/ssr` with email/password, session refresh in `proxy.ts`, route protection in server layout
- **Dark mode** via `next-themes` with system preference detection and manual toggle

### Database (4 tables)
- `meditations` — core content with title, prompt, generated script, status, public/private toggle
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

### Seed Data
- 2 test users (alice@example.com, bob@example.com — password: `password123`)
- 7 meditations across types: guided, body scan, breathwork, sleep, loving kindness, mindfulness, visualization
- 3 collections and cross-user favorites

---

## What's Next

### Audio Generation Pipeline
The core remaining feature. Converts a meditation script into a full audio file:

1. **Parse** script into segments (speech, pauses, silence, sound effects)
2. **Generate** TTS audio for speech segments via ElevenLabs API
3. **Generate** silence segments via FFmpeg
4. **Concatenate** all segments in order
5. **Mix** optional background music (with volume ducking)
6. **Upload** final MP3 to Supabase Storage
7. **Update** meditation status to `completed`

**Proposed architecture:** Use **Vercel Sandbox** as the ephemeral compute environment for audio processing (see `docs/audio-pipeline-architecture.md` for details).

### Audio Generation UX
The bridge between script creation and audio output — needs design:
- After saving a script, how does the user trigger audio generation?
- Voice selection flow: preview/audition voices before committing
- Background music and sound effect options
- Progress indication during the multi-step audio pipeline
- Preview and re-generate before finalizing

### Orchestration
- **Vercel Workflow** to coordinate the pipeline: trigger on script save, create sandbox, monitor progress, handle failures
- Status updates from `generating_script` → `script_ready` → `processing_audio` → `completed`

### Storage
- **Supabase Object Storage** for generated audio files
- Signed URLs for playback
- CDN delivery for production

### Audio Player
- Replace the stubbed placeholder with a real player
- Play/pause, seek, progress bar, volume control
- Stream from Supabase Storage signed URLs

### Additional Features (Future)
- Voice selection (multiple ElevenLabs voices)
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
ANTHROPIC_API_KEY=<your key>
```
