---
name: audio-pipeline
description: Use before editing src/lib/audio/generate-audio.ts, anything it imports, scripts/sound-effects.ts, or src/lib/meditation/sounds.ts, and when generated audio does not change after such an edit.
---

# Audio pipeline: the snapshot loop

`generate-audio.ts` does not run from the deploy. It runs from a Vercel Sandbox snapshot
built earlier and named by `AUDIO_SANDBOX_SNAPSHOT_ID`. An edit to anything baked into
that snapshot is invisible until a new snapshot is built and its ID deployed. Tests pass,
the PR merges, production keeps running the old code, and the symptom reads as a logic bug.

## What the snapshot bakes in

`scripts/create-sandbox-snapshot.ts` bundles `src/lib/audio/generate-audio.ts` with
esbuild, so every file it imports goes with it (today `loudness.ts`), and it renders or
downloads every sound in `scripts/sound-effects.ts` into `/sounds`. A new import in
`generate-audio.ts` is a new baked-in file: add it to the list in `CLAUDE.md`.

## The loop

1. Edit. Unit-test the pure part without ffmpeg; `loudness.test.ts` is the pattern.
2. Get a `VERCEL_OIDC_TOKEN`: `vercel env pull --environment=development <scratch file>`
   and copy the token out of that file. Pulling straight into `.env.local` overwrites it.
   The `VERCEL_TOKEN` in `.env.local` is invalid and the `vercel` CLI uses it when set, so
   run CLI commands as `VERCEL_TOKEN="" vercel …`.
3. `SOUND_EFFECTS_SUPABASE_URL` and `SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY` must point at
   the production project's `sound-effects` bucket. They live in the operator's
   `.env.local`; ask rather than guess if they are missing.
4. `npx tsx scripts/create-sandbox-snapshot.ts`, with the OIDC token in its environment.
   Copy the printed `snap_…` ID.
5. Set `AUDIO_SANDBOX_SNAPSHOT_ID` to it in `.env.local`.
6. `npx tsx scripts/test-audio-generation.ts`. It generates a short meditation with two
   sounds and writes `test-output/test-meditation.mp3`. Listen to it for the thing you
   changed; the script's checks do not hear.
7. Set `AUDIO_SANDBOX_SNAPSHOT_ID` in Vercel for Production, then redeploy. Changing an
   environment variable does not touch the running deployment.
8. Put the ID in the PR description and the task's Outcome section.
9. Once production is verified on the new ID: `npx sandbox snapshots list`, then
   `npx sandbox snapshots delete <old id>`. Snapshots never expire on their own.

## Sounds

A new sound goes in both `src/lib/meditation/sounds.ts` (what the prompt offers, with its
length in seconds) and `scripts/sound-effects.ts` (what the build produces);
`sounds.test.ts` fails if they drift. Levels were set by ear against the gongs in a mock
mix with normalized narration, because LUFS matching put the pure-tone synths about 15 dB
away from where they sounded right. Leave the levels alone unless you have listened.
`scripts/preview-sound-effects.ts` renders the synthesized ones locally for that.

## Local ffmpeg

The machine has none, and `fluent-ffmpeg` exists only inside the sandbox. For local
listening or for running a compiled `generate-audio.js`, `npm i ffmpeg-static fluent-ffmpeg`
into a scratch directory and pass the binary as `FFMPEG=`. ffmpeg's ebur128 filter prints
a placeholder summary (-70 LUFS) before the real one; `loudness.ts` reads the last one for
that reason, and a hand-written fixture will not show it.
