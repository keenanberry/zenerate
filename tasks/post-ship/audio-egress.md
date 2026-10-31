# Audio Egress

**Status:** Not started. Measured in production 2026-10-31.
**Priority:** Before Supabase Free's 5 GB of monthly egress binds, which at today's file
sizes is about 230 meditation page views a month. Read the Supabase usage report the week
signups open (operator TODO, section 8).
**Related:** `src/components/use-waveform-player.ts` (the one wavesurfer instance),
`src/lib/audio/generate-audio.ts` (the 192 kbps final mix; baked into the sandbox
snapshot), `src/lib/audio/signed-url.ts` (4-hour signed URLs), `src/lib/audio/workflow.ts`
(writes `generation_meta`), `tasks/post-ship/paid-tier.md` (the cost model this feeds).

## What was measured

Production, the 15-minute "Ho'oponopono" house meditation, Chrome, 2026-10-31:

- **One `GET` of the audio object per page view, 23,469,496 bytes (22.4 MB)**, made by
  wavesurfer's `fetch`, not by the `<audio>` element. There is no double download:
  wavesurfer 7.12 fetches the whole file as a blob to decode the waveform, then plays the
  blob through an object URL (`loadAudio` then `setSrc` in `dist/wavesurfer.js`), because
  the upload sets `audio/mpeg` and the element can play that type.
- **The download starts on mount, before anyone presses play.** Someone who opens the
  page, reads the script and leaves has cost a full file of egress.
- **Every view is a full download.** Reloading signs a fresh URL (the token differed
  between two loads), so the browser cache never serves a second view.
- The bucket answers range requests (`206`), so streaming would work if the player asked
  for it.

So egress a month is roughly meditation page views times file size, with the studio's
audio card and the owner's own visits counted too. At 192 kbps a file is about 1.44 MB a
minute: 10 min is about 15 MB, 15 min about 22 MB, 30 min about 45 MB. Supabase Free
allows 5 GB a month (about 230 views of a 15-minute file); Pro allows 250 GB and bills
about $0.09 a GB past that. Storage is the same story: 1 GB free is about 45
fifteen-minute files.

## Two fixes, which compound

1. **Precomputed peaks, so the player streams.** Give wavesurfer `peaks` and `duration` at
   creation and it skips the fetch: `loadAudio` sets the element's `src` to the URL and the
   browser streams it with range requests. A view that never plays then costs a few hundred
   KB, and a full listen costs one file. Compute the peaks in the sandbox after the final
   mix (FFmpeg can write low-rate PCM to read peaks from; about 1,000 values per file, a few
   KB as JSON) and store them in `generation_meta.peaks` beside `tts_characters`. Hydrate
   them with the audio URL. Meditations rendered before the change have no peaks and keep
   today's path until a backfill script renders peaks from the stored files.
   - `normalize: true` works on supplied peaks too.
   - Pass wavesurfer its own `media` element with `preload="metadata"`, or Chrome buffers
     ahead on mount anyway.
   - The hook already notes the element can play before the waveform decodes, so nothing in
     the two skins (`AudioPlayer`, `SessionPlayer`) depends on the blob. Check iOS Safari:
     `play()` from a tap must still start a streamed source.
2. **A lower bitrate.** Narration over an ambient bed does not need 192 kbps. 128 kbps cuts
   every figure above by a third; 96 kbps halves them. Each is a one-line change in
   `generate-audio.ts` and a snapshot rebuild (`audio-pipeline` skill). The operator listens
   to the same meditation at 192, 128 and 96 before choosing; nothing ships on a number.

Peaks are the larger win (a view no longer costs a file) and change nothing audible, so they
go first. The bitrate change is cheap once the snapshot is being rebuilt anyway.

## Scope sketch

1. In the sandbox step, after the mix: compute peaks and return them with `ttsCharacters`;
   `workflow.ts` writes them into `generation_meta`.
2. `hydrateAudioUrls` (or the rows it hydrates) carries `peaks` and `duration` to the
   player; `useWaveformPlayer` passes them to `WaveSurfer.create`.
3. A backfill script for existing files (it reads each object once; count that egress).
4. Rebuild the snapshot and redeploy `AUDIO_SANDBOX_SNAPSHOT_ID`. The bitrate decision goes
   in the same rebuild if the listening test is done.
5. Re-measure on the same production meditation: bytes per view with and without pressing
   play.

## Not in scope

A CDN in front of storage (Supabase Storage already sits behind one, and cached egress
counts toward the quota anyway; a public bucket would undo task 58's visibility work), and
offline playback (a service worker, `tasks/ship/24`).
