# Audio Pipeline Architecture — Vercel Sandbox Approach

## Overview

Instead of deploying a persistent audio processing service (e.g., on Fly.io or Railway), we use **Vercel Sandbox** as ephemeral compute for audio generation. Each meditation gets its own isolated microVM that spins up, processes audio, uploads the result, and is destroyed.

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
User saves script
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
       ├── 5. Upload MP3 to Supabase Storage
       │
       ├── 6. Update meditation status → completed
       │
       └── 7. Destroy sandbox
```

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

## Open Questions

1. **Sandbox session limits** — Need to verify max runtime for audio processing (some meditations could take 60+ seconds to process)
2. **File size limits** — Long meditations (30 min) could produce large intermediate files
3. **Network access** — Sandbox needs outbound access to ElevenLabs API and Supabase Storage
4. **Snapshot persistence** — How long do snapshots persist? Do they need periodic refresh?
5. **Concurrent sandboxes** — How many can run in parallel under the free/pro plan?
