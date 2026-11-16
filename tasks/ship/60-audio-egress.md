# Audio Egress

**Status:** Done (PRs #128 and #130, 2026-11-16). Snapshot
`snap_sXOy59qkIhIo95G7Y9N33oAaAPMY` (peaks, 128 kbps) live in Production and Preview, every
production render backfilled, and a page view without play measured in production at
90,256 bytes against 23,469,496. The operator's iPhone check passed, and production renders
on the new snapshot, a first one and an edit of it, stored their peaks at 128 kbps; the
older snapshots are deleted.
**Priority:** Phase 6, before signups open. Approved by the operator 2026-11-16; promoted
from `tasks/post-ship/audio-egress.md`.
**Phase:** 6
**Depends on:** nothing. Related: `src/components/use-waveform-player.ts` (the one
wavesurfer instance), `src/lib/audio/generate-audio.ts` (the final mix, 192 kbps until this task; baked into
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
- [x] The backfill script is ready, and unrun against production until the operator says.
      *Run against local Supabase: the count, then `--yes`, then the count again (zero).
      The operator then chose to run it in production on 2026-11-16 (Outcome).*
- [x] The new snapshot is live in Production, and the PR and this file name its ID.
      *`snap_dJAgDRqRJ9ugYNwe0QWMl7uAUIy4`, set for Production and Preview, production
      redeployed 2026-11-16 (Outcome).*
- [x] The production measurement is recorded: bytes for a page view without pressing
      play, and for a short play.
      *2026-11-16, Ho'oponopono, the 2026-10-31 baseline page: 90,256 and 3,218,370
      (Outcome).*
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
- **An expired URL.** The old path held the whole file as a blob, so the 4-hour signed URL
  only had to work once. A streaming element fetches by range on play, seek and resume,
  so a page left open or a long pause outlives the URL (found in review). On the
  element's `error` the hook asks for a fresh URL (`getMeditationAudio`, or
  `getMeditationVersion` for an earlier version), restores the position and plays again
  if it was playing or Play was just pressed; at most once a minute, so a file that is
  really gone cannot loop. Checked in Chrome by breaking the token by hand: paused, it
  recovered and stayed paused; with Play pressed, it recovered and played.
- **Accepted.** Earlier versions reads every archived version's peaks on the owner's page,
  though only the selected one plays: owner-only, usually one or two versions, about
  3 KB each gzipped.
- **Backfill** (`scripts/backfill-peaks.ts`). Lists the current audio and kept earlier
  versions without peaks (drafts have no audio of their own), prints the file count and
  total bytes, and stops unless passed `--yes`; then downloads each once, reads its peaks
  with the same reader and merges them in, skipping a row whose audio changed meanwhile.
  **Run in production on 2026-11-16** at the operator's go-ahead, after this PR, rather
  than after the 30 Nov reset: this cycle's unused egress resets anyway, so spending it now
  keeps the launch month's 5 GB whole, and every existing page streams from today. The
  count first (19 files, 17 current and 2 versions, 391,645,073 bytes, as listed that
  morning), then `--yes`: 19 written, 0 skipped, 0 failed, 391,645,073 bytes downloaded;
  a second count found none left.
- **Production measurement** (2026-11-16, after the backfill, on the new snapshot's
  deployment). Ho'oponopono, the same page as the 2026-10-31 baseline, signed out, a
  clean headless Chrome counting the storage host's bytes from its network events:

  | | Bytes from storage |
  |---|---|
  | A page view, before (2026-10-31) | 23,469,496 |
  | A page view without play | 90,256 (one metadata range request, aborted) |
  | A page view and 15 s of play | 3,218,370 (Chrome buffers about two minutes ahead) |

  The peaks add about 3 KB of gzipped database egress to each view. So 5 GB is now about
  54,000 views that never press play, rather than 230; a full listen still costs a file,
  which the bitrate decides.
- **Snapshot** `snap_dJAgDRqRJ9ugYNwe0QWMl7uAUIy4` (321.0 MB), built from `main` after
  PR #128 merged, so production ran the new code on the old snapshot first and took the
  no-peaks path meanwhile. `test-audio-generation.ts` passed on it with the new checks
  (4,771 peaks over 23.9 s, the same as a local read of the file; 192 kbps stereo,
  -20.8 LUFS integrated, as before). A render through the local app on it stored 4,044
  peaks and 20.217 s in `generation_meta`, and the page swapped from the progress view to
  a streaming player. `AUDIO_SANDBOX_SNAPSHOT_ID` was updated for Production, and for
  Preview too, which held the same old ID and would break once it is deleted; production
  was then redeployed (`zenerate-3n8dw9yds`). The previous snapshot,
  `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`, stays until the operator's first production render
  on the new one (`audio-pipeline` skill, step 9). The bitrate is unchanged: no choice had
  been made by the rebuild.
- **Previews read production Supabase.** `NEXT_PUBLIC_SUPABASE_URL` is one variable for
  Production and Preview, so a preview deployment's meditation pages spend the same
  egress. None was opened for this task.
- **Bitrate samples** for the operator's ear: "Patience and Kindness" (10 min, ocean bed,
  downloaded once, 14,987,014 bytes) at 192 (the production file), 128 and 96 kbps, in
  `test-output/bitrate/` of the task's worktree with a `LISTEN.md`.
- **Bitrate: 128 kbps** (PR #130). The operator could not tell the three apart much and
  chose 128 on 2026-11-16, after the first rebuild. The narration arrives from ElevenLabs at
  128 kbps, so 192 only spent its extra bits on the bed, and 96 would be the first step
  below the voice's own source. `OUTPUT_BITRATE` in `generate-audio.ts` sets both final
  encodes (narration alone, and over a bed). A 15-minute file is now about 14.4 MB, so a
  full listen and the storage per render both drop by a third. Renders from before stay at
  192 unless re-rendered. `test-audio-generation.ts` now checks the output's bitrate.
  Rebuilt as `snap_sXOy59qkIhIo95G7Y9N33oAaAPMY` (321.5 MB) from the PR's branch; the test
  passed with the ocean bed: 128 kb/s stereo by ffprobe, 6,245 peaks over 31.2 s. Set for
  Production and Preview, production redeployed. It replaces
  `snap_dJAgDRqRJ9ugYNwe0QWMl7uAUIy4`, which was live for about three hours and made one
  production render (peaks, 192 kbps). Once the operator had rendered on the new one, and
  edited and re-rendered that meditation (both at 128 kbps with their peaks, the first
  archived with its own), both it and `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8` were deleted.
