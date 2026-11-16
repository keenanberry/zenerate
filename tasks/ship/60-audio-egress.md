# Audio Egress

**Status:** In progress. Code merged (this PR); the snapshot rebuild, its redeploy and the
production measurement follow, and the operator items are in `tasks/OPERATOR-TODO.md` §5.
**Priority:** Phase 6, before signups open. Approved by the operator 2026-11-16; promoted
from `tasks/post-ship/audio-egress.md`.
**Phase:** 6
**Depends on:** nothing. Related: `src/components/use-waveform-player.ts` (the one
wavesurfer instance), `src/lib/audio/generate-audio.ts` (the 192 kbps final mix; baked into
the sandbox snapshot), `src/lib/audio/signed-url.ts` (4-hour signed URLs),
`src/lib/audio/workflow.ts` (writes `generation_meta`), `tasks/post-ship/paid-tier.md` (the
cost model this feeds).

## Why

Supabase Free allows 5 GB of egress a month and 1 GB of storage. On 2026-11-16, 17 days
into the 30 Oct–30 Nov cycle, the operator's own seeding had used 2.887 GB of egress and
0.351 GB of storage. Every meditation page view downloaded the whole MP3 on mount, so the
free tier was about 230 views a month. Go-live waits for the 30 Nov reset, and this is
what makes that month last.

### What was measured (2026-10-31)

Production, the 15-minute "Ho'oponopono" house meditation, Chrome:

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

At 192 kbps a file is about 1.44 MB a minute: 10 min is about 15 MB, 15 min about 22 MB,
30 min about 45 MB. Pro allows 250 GB and bills about $0.09 a GB past that.

## Scope

Two fixes, which compound. Peaks are the larger win and change nothing audible, so they
ship here; the bitrate is prepared for the operator's ear.

1. **Precomputed peaks, so the player streams.** In the sandbox, after the final mix,
   read the waveform's peaks and the length, and return them with `ttsCharacters`;
   `workflow.ts` stores them in `generation_meta`, and drafts and archived versions carry
   them through promotion. The meditation page delivers them with the signed URL (by the
   service role for a signed-out page, since `anon` may not read `generation_meta`), and
   `useWaveformPlayer` hands them to wavesurfer with its own `preload="metadata"` element,
   so nothing downloads until play. A render without peaks keeps today's path. A backfill
   script covers renders from before.
2. **A lower bitrate.** Narration over an ambient bed does not need 192 kbps: 128 cuts every
   figure by a third, 96 halves them. One line in `generate-audio.ts` and the same snapshot
   rebuild. Samples first; the operator chooses by ear.

## Not in scope

A CDN in front of storage (Supabase Storage already sits behind one, and cached egress
counts toward the quota anyway; a public bucket would undo task 58's visibility work);
offline playback (`tasks/ship/24`); the list pages' play buttons (`inline-play-button.tsx`,
`track-play-button.tsx`), which already stream with `new Audio(url)` on tap and cost
nothing until played.

## Done when

- [x] A meditation page with peaks shows the same waveform and downloads no audio until
      play.
      *Locally, signed out, Chrome: 42,980 bytes from storage for a view without play (one
      aborted metadata range request), against 14,987,419 for the same file without peaks.
      Waveform: see Outcome.*
- [x] Renders write peaks, and drafts and archived versions keep theirs.
      *`workflow.test.ts` "waveform peaks"; the compiled `generate-audio.js` run locally on
      a 10-minute mix wrote 8,000 peaks and a length matching ffprobe's.*
- [x] The backfill script is ready and unrun against production.
      *Run against local Supabase: the count, then `--yes`, then the count again (zero).*
- [ ] The new snapshot is live in Production, and the PR and this file name its ID.
- [ ] The production measurement is recorded: bytes for a page view without pressing
      play, and for a short play.
- [x] The operator items are in `tasks/OPERATOR-TODO.md` §5: the iPhone check, the
      bitrate, the backfill, one production render on the new snapshot.

## Outcome

- **Peaks** (`src/lib/audio/peaks.ts`, baked into the snapshot). ffmpeg decodes the final
  mix to 8 kHz stereo PCM, wavesurfer's own decoding rate, and `PeakReader` keeps the
  loudest sample of either channel per 5 ms block, then reduces those to **8,000 peaks**
  stored as whole percents of full scale. A failed read leaves them out; the render still
  succeeds. `generate-audio.ts` writes them into `result.json`, `workflow.ts` validates
  them (`waveformOf`) and stores `generation_meta.peaks` and `.duration`. The current
  snapshot returns none, which the merged code takes as "no peaks", so the order was merge,
  then snapshot.
- **8,000, not the plan's 1,000.** wavesurfer gives a bar every peak whose position rounds
  to it, so a peak's whole window lands in one bar. On the 10-minute test file 1,000 peaks
  put a loud onset in the neighbouring bar 5 times in the card's 127 bars, once 47px off.
  From about 5,000 every bar is within 3px of the ffmpeg-decoded drawing; 8,000 leaves
  room. Stored as integers they are 16 KB of JSON (25 KB as Postgres prints it); production
  gzips REST responses (checked: `content-encoding: gzip`), and the lookup that carries
  them compresses to about 3 KB.
- **Same waveform.** Against Chrome's own decode of the same file, 99% of the 8,000 peaks
  are within 2 points of 100 and the maximum is the same. Drawn, the session player's
  waveform is within 4px of the old one on every column; on the 80px card 120 of 127 bars
  are within 3px of the old drawing. The other seven are at bar edges, and the worst is a
  bar the old drawing got wrong: 7px where Chrome's own decode of the file gives 80, which
  the peaks draw. Nothing else about
  the player changes; checked dark and light, desktop and 390px.
- **Delivery.** `hydrateAudioUrl(row, { waveform: true })` sets `waveform` from the row's
  `generation_meta`, or for a signed-out row from the existing service-role lookup of a
  public meditation's path, selecting only `generation_meta->peaks` and `->duration`. The
  anon grant is unchanged: locally `anon` gets 42501 on `generation_meta`, as production
  does, and a signed-out page still drew from peaks and streamed. The peaks never leave
  inside `generation_meta`. Only `getMeditation`, the new `getMeditationAudio` (the page
  after a render, the studio card) and `getMeditationVersions` ask; the signed-in list
  reads now name their columns (`ROW_COLUMNS`) and read neither `generation_meta` nor the
  `search` vector. `getMeditationStatus`, which the render progress polls every 3 seconds,
  no longer signs a URL it no longer returns.
- **Player.** `useWaveformPlayer` creates an `<audio preload="metadata">` inside the
  waveform's container and hands wavesurfer `media`, `peaks` and `duration`; on unmount it
  pauses and empties the element, which wavesurfer leaves alone when it did not create it.
  `AudioPlayer` (studio card, Earlier versions) and `SessionPlayer` (the meditation page)
  pass the waveform through.
- **Backfill** (`scripts/backfill-peaks.ts`). Lists the current audio and kept earlier
  versions without peaks (drafts have no audio of their own), prints the file count and
  total bytes, and stops unless passed `--yes`; then downloads each once, reads its peaks
  with the same reader and merges them in, skipping a row whose audio changed meanwhile.
  Production on 2026-11-16 holds 19 files, 391.6 MB (17 current, 2 versions), so the run
  costs about 0.39 GB of egress. Not run against production.
- **Bitrate samples** for the operator's ear: "Patience and Kindness" (10 min, ocean bed,
  downloaded once, 14,987,014 bytes) at 192 (the production file), 128 and 96 kbps, in
  `test-output/bitrate/` of the task's worktree with a `LISTEN.md`.
