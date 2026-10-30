# Architecture

Zenerate is a Next.js 16 + Supabase app with an AI script generation pipeline and a sandbox-based audio generation pipeline.

## Audio Pipeline — Vercel Sandbox Approach

Audio generation runs in **Vercel Sandbox**: each meditation gets its own isolated Firecracker microVM that spins up from a pre-built snapshot, processes audio, uploads the result, and is destroyed. No persistent service to run.

Reference: https://vercel.com/docs/vercel-sandbox

## Why Vercel Sandbox

| Concern | Fly.io / Railway | Vercel Sandbox |
|---------|------------------|----------------|
| Infrastructure | Persistent service to deploy and maintain | Ephemeral — no infra to manage |
| Cost model | Always-on or scale-to-zero with cold starts | Pay per sandbox session (destroy when done) |
| FFmpeg | Pre-installed in container | Install via snapshot (cached for reuse) |
| Startup | Cold start latency for scale-to-zero | Millisecond startup from snapshots |
| Integration | Webhook/API bridge to main app | Native Vercel SDK, works with Workflow |
| Isolation | Shared container resources | Firecracker microVM per job — full isolation |
| Scaling | Manual scaling config | Automatic — each job gets its own VM |

**Key advantage:** Zero operational overhead. No Dockerfile, no deploy pipeline, no monitoring a separate service. The sandbox is a function call from the main app.

## Architecture

```
Owner clicks Make audio on the studio chat's audio card
(or the meditation page's Generate / free retry)
       │
       ▼
POST /api/audio/generate (status check, render bounds, voice check, quota reservation)
       │
       ▼
Vercel Workflow (orchestrator)
       │
       ├── 1. Create Sandbox (from snapshot with FFmpeg + Node.js deps)
       │
       ├── 2. Upload script + config to sandbox filesystem
       │
       ├── 3. Run audio generation script inside sandbox
       │       ├── Call ElevenLabs TTS for speech segments
       │       ├── Generate silence with FFmpeg
       │       ├── Copy sound effect files
       │       ├── Concatenate all segments
       │       └── Mix background music (optional)
       │
       ├── 4. Download final MP3 from sandbox
       │
       ├── 5. Upload MP3 to Supabase Storage at
       │       <user_id>/<meditation_id>/<render_id>.mp3 (never upserted)
       │
       ├── 6. Update meditation status → completed, or for a rendered
       │       draft, archive the current version and promote the draft
       │
       └── 7. Destroy sandbox
```

## What Triggers a Render

The studio chat is the main trigger. The chat agent's `offerAudio` tool has no `execute`:
it only shows the audio card (`src/components/studio/audio-card.tsx`), and a render starts
when the owner presses **Make audio** there. The card posts to `/api/audio/generate` and
only then answers the tool with `addToolOutput`, so the agent can never spend a render on
its own. The only other callers of the route are the meditation page's generate panel and
its free retry (`audio-section.tsx`).

The route accepts a meditation in `script_ready`, or in `completed` when it has a
row in `meditation_drafts` (a revision the agent made after the audio existed). The second is a
**draft render**, described next.

## Who Writes What (task 58)

Grants are checked before RLS, and RLS restricts rows, not columns. So the owner's role is
narrowed by column (`supabase/migrations/20261030000058_launch_security.sql`), and
everything else is written on the service role after an RLS read has shown the row is
theirs.

| Table | `authenticated` may write | Service role only |
|---|---|---|
| `meditations` | insert `user_id, title, prompt, description, tags, script, status, is_public, settings` (policy: status `generating_script`/`script_ready`, not public); update `title, description, tags, script, is_public, settings, updated_at` | `status`, `is_featured`, `audio_path`, `audio_url`, `generation_meta`, `user_id` |
| `meditation_versions` | delete | insert (the workflow archives) |
| `chat_messages` | nothing; reads only | every save (the chat route) |
| `chat_turns`, `audio_generation_events` | nothing | `reserve_chat_turn`, `reserve_audio_generation` |

Publishing needs `status = 'completed'` and an `audio_path` (`updateMeditation`, and the
`meditations_guard_publish` trigger for a write that skips it). `anon` reads only the public
columns of `meditations` (no `user_id`, `prompt`, `audio_path`, `audio_url`,
`generation_meta`), so a signed-out read names its columns, and `hydrateAudioUrls` signs a
public row's audio by looking the path up with the service role. It never signs a path
outside the row's own folder, and `removeAudio` never removes one (`ownsAudioPath` in
`src/lib/audio/storage.ts`).

The script and settings stay the owner's to write, so a render is bounded on the server:
`src/lib/audio/render-bounds.ts` caps narration characters, each `PAUSE` and `SILENCE`, total
runtime and script length, refuses a sound marker that names a path, drops a sound outside
the catalog, and clamps `settings.volume`. The generate route checks it before reserving a
generation, and the workflow's `fetchAndParse` checks it again on what it hands the sandbox,
since the owner can edit between the two. The route also checks the effective voice (the
requested one, else the saved one, else the default) against the collection and always hands
it to the workflow. A failed render counts toward both audio caps (its free retry makes a
genuine failure whole); only the route's own `refunded` events give a slot back.

## Draft Renders and Archived Versions

A meditation row always describes its **current version**: `script`, `audio_path`,
`settings.voice` and `generation_meta`. Older versions live in `meditation_versions`,
which is owner-only under RLS. A revision made after the audio exists goes to
`meditation_drafts.script` (`writeScript` decides this by whether `audio_path` is set). One
row per meditation; no row means no draft.

`meditation_drafts` is owner-only under RLS and has **no `anon` grant**, so a draft is
unreachable to anyone else by REST, RPC or page payload, even on a public meditation. Never
put draft text or draft state back on `meditations`: `anon` may read its public columns
(see "Who Writes What" below), and `authenticated` may read every column of anyone's public row.

A draft render never touches `meditations` at all until promotion. The meditation stays
`completed` the whole time, so the public page and Discover keep playing the current
version. The render's own state is `meditation_drafts.render_status`:

| `render_status` | Meaning |
|---|---|
| `null` | No render of this draft in flight |
| `processing` | Set by `/api/audio/generate` with a compare-and-set on `render_status`, so a double click starts one run |
| `failed` | Set by the workflow's `markFailed`. The draft, the current version and `status` are untouched; the free retry applies |

`writeScript` refuses while `render_status = 'processing'`, so the draft cannot change under
a run. The voice the owner picked is not saved to `settings` at the start (settings belong
to the current version); the workflow carries it and writes it at promotion. The card's
free retry resends it.

**Promotion** (`promoteDraft` in `workflow.ts`, run by the `finalize` step):

1. Archive the current version into `meditation_versions`: its script, `audio_path`,
   `settings.voice` and `generation_meta`. Skipped when that `audio_path` is already
   archived, so a retried step archives once.
2. Promote: `script = draft`, the new `audio_path`, `generation_meta` and voice,
   `status = completed`. Skipped when the meditation already carries this render's
   `audio_path`, so a step retried after this point does not archive the new version.
3. Delete the `meditation_drafts` row. A retried step finds no draft (or one that no
   longer matches) and does nothing.

The archived version's audio file stays where it was. Every render writes a new file, so
nothing is overwritten. The owner then decides:

- **The chat card** asks "Keep the previous version, or replace it?" once it has watched
  the render finish. **Replace** calls `deleteMeditationVersion`, which deletes the row
  (RLS proves ownership) and then its storage object. **Keep** does nothing. A card loaded
  after the render finished does not ask; the meditation page handles it from there.
- **The meditation page** shows the owner an **Earlier versions** switcher
  (`version-switcher.tsx`) when archived rows exist. A version plays through the same
  hydrator (`getMeditationVersions`), downloads through
  `/api/audio/[id]/download?version=<id>`, and can be deleted. Visitors never see it: the
  read is owner-only under RLS. The page also links the owner to **Continue in chat**
  (`/create/[chatId]`) when the meditation has a chat.

`getMeditation` blanks `prompt` for anyone but the owner, because the page serializes the
whole row into its client payload. Drafts need no such step: they are not on the row.

## Audio Storage Layout

Bucket `meditation-audio`, private. Paths are `<user_id>/<meditation_id>/<render_id>.mp3`,
where `render_id` is a fresh UUID per upload (`uploadAudio` in `storage.ts`, `upsert:
false`). One folder per user, so deleting a user's audio is removing their prefix; one
folder per meditation, so `deleteMeditation` removes the meditation's folder after the row
delete succeeds. Rows from before task 32 may still hold a flat `<meditation_id>.mp3`
path; every reader goes through the stored `audio_path`, so they keep playing, and the
deletes remove those explicitly.

Storage does not cascade from the database. Whatever deletes a row that points at audio
removes the object too: `deleteMeditation` (the folder plus any flat paths) and
`deleteMeditationVersion` (one object).

None of this is in the sandbox snapshot: `generate-audio.ts` writes `output.mp3` inside
the sandbox, and `storage.ts` uploads it from the Vercel function.

Quota: `reserveAudioGeneration` in `src/lib/audio/quota.ts` enforces the per-user and
global monthly caps through the `reserve_audio_generation` RPC. Users listed in
`QUOTA_EXEMPT_USER_IDS` skip both caps, and their renders are left out of the global total.

## Sandbox Template

Create a snapshot with all dependencies pre-installed so each job starts instantly:

**Runtime:** `node22` (LTS, best compat with audio libraries)

**Pre-installed in snapshot:**
- FFmpeg (via `sudo dnf install ffmpeg` or download static binary)
- Node.js dependencies: `fluent-ffmpeg`, `elevenlabs` SDK, `@supabase/supabase-js`
- Sound effects library (gong, bells, chimes, bowls — ~5MB total)

**Snapshot creation (one-time setup):**
```typescript
import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.create({ runtime: 'node22' });

// Install FFmpeg
await sandbox.commands.run('sudo dnf install -y ffmpeg');

// Install Node.js deps
await sandbox.files.write('package.json', JSON.stringify({
  dependencies: {
    'fluent-ffmpeg': '^2.1.2',
    'elevenlabs': '^2.0.0',
    '@supabase/supabase-js': '^2.0.0',
  }
}));
await sandbox.commands.run('npm install');

// Upload sound effects
await sandbox.files.write('sounds/gong-gentle.mp3', gongBuffer);
await sandbox.files.write('sounds/bell-tibetan.mp3', bellBuffer);
// ... etc

// Save snapshot for reuse
const snapshot = await sandbox.snapshot();
// Store snapshot.id for use in production
```

## Audio Generation Script

The script that runs inside the sandbox:

```typescript
// generate-audio.ts (runs inside sandbox)
import { ElevenLabsClient } from 'elevenlabs';
import ffmpeg from 'fluent-ffmpeg';
import { createWriteStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';

interface Segment {
  type: 'speech' | 'pause' | 'silence' | 'sound';
  content?: string;
  duration?: number;
  file?: string;
}

async function generateAudio(segments: Segment[], config: {
  voiceId: string;
  backgroundMusic?: string;
  musicVolume?: number;
}) {
  const elevenlabs = new ElevenLabsClient();
  const tempDir = './temp';
  await mkdir(tempDir, { recursive: true });

  const audioFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const outPath = `${tempDir}/segment_${i}.mp3`;

    switch (segment.type) {
      case 'speech':
        const stream = await elevenlabs.textToSpeech.stream(config.voiceId, {
          text: segment.content!,
          model_id: 'eleven_multilingual_v2',
        });
        const writer = createWriteStream(outPath);
        for await (const chunk of stream) writer.write(chunk);
        writer.end();
        break;

      case 'pause':
      case 'silence':
        await generateSilence(segment.duration!, outPath);
        break;

      case 'sound':
        await copyFile(`./sounds/${segment.file}`, outPath);
        break;
    }

    audioFiles.push(outPath);
  }

  // Concatenate all segments
  const voicePath = `${tempDir}/voice-only.mp3`;
  await concatenateAudio(audioFiles, voicePath);

  // Mix background music if provided
  const finalPath = './output.mp3';
  if (config.backgroundMusic) {
    await mixBackgroundMusic(voicePath, config.backgroundMusic, finalPath, config.musicVolume ?? 0.15);
  } else {
    await copyFile(voicePath, finalPath);
  }

  return finalPath;
}
```

## Workflow Integration

```typescript
// src/lib/audio/workflow.ts
import { sleep } from 'workflow';
import { Sandbox } from '@vercel/sandbox';
import { createClient } from '@supabase/supabase-js';

export async function processAudio(meditationId: string) {
  'use workflow';

  const supabase = createClient(/* ... */);

  // Update status
  await updateStatus(meditationId, 'processing_audio');

  // Create sandbox from cached snapshot
  const sandbox = await createSandbox();

  try {
    // Upload the generation script and config
    await uploadToSandbox(sandbox, meditationId);

    // Run audio generation
    const result = await runGeneration(sandbox);

    // Download the output file
    const audioBuffer = await downloadFromSandbox(sandbox);

    // Upload to Supabase Storage
    const audioUrl = await uploadToStorage(supabase, meditationId, audioBuffer);

    // Update meditation record
    await updateStatus(meditationId, 'completed', audioUrl);

  } catch (error) {
    await updateStatus(meditationId, 'failed');
    throw error;
  } finally {
    await sandbox.destroy();
  }
}

async function createSandbox() {
  'use step';
  return Sandbox.create({
    runtime: 'node22',
    snapshot: process.env.AUDIO_SANDBOX_SNAPSHOT_ID,
  });
}

async function runGeneration(sandbox: Sandbox) {
  'use step';
  return sandbox.commands.run('node generate-audio.js');
}
```

## Cost Estimate

Per meditation (assuming ~2 min of speech, 10 min total with silence):

| Item | Cost |
|------|------|
| ElevenLabs TTS (~1500 chars) | ~$0.30 |
| Vercel Sandbox (~30s processing) | ~$0.01-0.05 |
| Supabase Storage (10MB MP3) | negligible |
| **Total per meditation** | **~$0.35** |

## Key Files

| File | Purpose |
|---|---|
| `src/components/studio/audio-card.tsx` | The chat's voice + Make audio card; the main trigger |
| `src/app/api/audio/generate/route.ts` | Entry point — auth + ownership check, triggers workflow |
| `src/lib/audio/quota.ts` | Monthly caps, free retries and the operator exemption |
| `src/lib/audio/workflow.ts` | Vercel Workflow — durable orchestration |
| `src/lib/audio/generate-audio.ts` | Runs inside the sandbox (baked into snapshot) |
| `src/lib/audio/storage.ts` | Storage paths, upload, removal + status updates |
| `src/components/version-switcher.tsx` | The owner's Earlier versions on the meditation page |
| `src/components/studio/replace-or-keep.tsx` | The chat's keep-or-replace question after a draft render |
| `src/lib/meditation/parser.ts` | Parses script markup into typed segments |
| `src/lib/meditation/types.ts` | Meditation / segment / status types |
| `scripts/create-sandbox-snapshot.ts` | Builds the sandbox snapshot (run when `generate-audio.ts` changes) |

## Status State Machine

```
generating_script → script_ready → processing_audio → completed
                                                    ↘ failed
```

`src/components/audio-section.tsx` switches on `status` to render the generate panel, processing status, audio player, or retry state. The studio's audio card does the same inside the chat.

A draft render does not move `status`: a `meditation_drafts` row and its `render_status`
can be set alongside `completed`, and the meditation stays `completed` from start to
promotion or failure. The owner's chat card folds `render_status` into what it shows (`getAudioOffer`
reports `processing` as `processing_audio` and `failed` as `failed`), so it still shows
progress and failure. See Draft Renders and Archived Versions above.
