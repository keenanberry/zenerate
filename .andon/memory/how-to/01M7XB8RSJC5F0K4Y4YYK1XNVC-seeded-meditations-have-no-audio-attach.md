---
id: 01M7XB8RSJC5F0K4Y4YYK1XNVC
kind: how-to
status: proposed
title: "Seeded meditations have no audio: attach a local test clip to exercise the session player"
tags: [testing, audio, local-dev]
paths: []
source: run 268f3e74
confidence: 0.6
supersedes: none
created: 2026-11-20
---

supabase/seed.sql's meditations are completed but have no audio_path, so the meditation page renders no Play and nothing that depends on playback (session view, play counting, end-of-listen behaviour) can be browser-checked as seeded. To test it locally: make a short clip (`ffmpeg -f lavfi -i "sine=frequency=220:duration=12" -ac 1 -b:a 64k test.mp3`), upload it with the service-role key to the `meditation-audio` bucket at `<owner_user_id>/<meditation_id>/<name>.mp3` (POST `$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/meditation-audio/<path>` with `x-upsert: true`; the path must pass `ownsAudioPath` or it is not signed), then `update meditations set audio_path = '<path>'`. Without peaks, wavesurfer plays through its own detached <audio>, so `document.querySelector('audio')` is null: seek with the session view's Position slider (focus it, press End) or let the short clip run out. Undo both (delete the object, null audio_path) afterwards so the shared local DB matches main.

Evidence: ZEN-6 browser check of the rating prompt; src/lib/audio/storage.ts ownsAudioPath; src/components/use-waveform-player.ts streamingElement
