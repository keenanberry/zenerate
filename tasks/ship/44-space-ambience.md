# Space and Chant Beds, Previews at the In-Mix Level

**Status:** Done (PR pending review). Live once the operator sets `AUDIO_SANDBOX_SNAPSHOT_ID=snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8`
**Priority:** Phase 6
**Phase:** 6 (seed & open)
**Depends on:** 40 (ambient sound)

## Why

The operator listened to real renders of all five beds under narration (snapshot
`snap_43Xz3L2sxNGvK1hTk6AloMDdNcJH`):

- Rain, ocean, forest and drone sound good at their in-mix levels. Those levels stay.
- Brown noise didn't work for them. They wanted something more ethereal, "like space",
  and later also asked for subtle chanting.
- Ocean and forest were "really loud in the player". The previews were the -28 LUFS bed
  files, but in a meditation a bed sits at -36 to -38 LUFS in the silences under
  -21 LUFS narration, so the previews played about 9 dB louder than the result.

## Decisions

- **Brown noise is removed**, and no bed replaces its id. A meditation still saved with
  `settings.music = 'brown-noise'` reads as no bed (`savedAmbience` returns null) and
  renders with narration alone.
- **Space is synthesized by FFmpeg**, as the drone is, so there's no licensing question.
- **Space is exactly periodic over 90 s**, so it loops with no crossfade. Every frequency
  and envelope completes a whole number of cycles in 90 s, written as an exact `k/90`
  fraction, because a rounded decimal drifted about 0.03 rad by the seam. The echo tails
  are linear, so their output is periodic too once the longest tap (8.2 s) has passed.
- **The tails are feedback-free `aecho` taps, not an `afir` convolution reverb.** The
  first snapshot build showed that the sandbox's FFmpeg is 7.0.2: `ffmpeg-static@latest`
  ships 7.0.2 on Linux but 6.0 on macOS. afir's automatic impulse normalization changed
  in 6.1 (`gtype` is ignored and `irnorm` applies), so the same recipe came out at
  -47.6 LUFS in the snapshot against -28 locally. aecho renders the same on both, matching
  to 2.7e-5. Two shelving filters bring its band balance to within 1.6 dB of the afir
  version the operator approved.
- **Space goes into the snapshot as FLAC** (`sounds/ambient/space.flac`, about 4 MB). MP3
  leaves a small error at a file's first and last samples. Noise hides it, and the drone
  starts from zero, but on a smooth pad it's a tick at every loop point: 0.013 against a
  normal sample step of 0.002. The browser preview stays MP3, because it plays once and
  doesn't loop.
- **The previews are derived, not the source.** The recorded beds moved from
  `public/sounds/ambient/` to `scripts/ambient/`, unchanged and with the same checksums,
  and the snapshot reads them from there. `public/sounds/ambient/` now holds every bed
  turned down by `PREVIEW_GAIN_DB` = `AMBIENT_PREVIEW_LUFS` (-37) minus `BED_LUFS` (-28).
  This is one constant in `scripts/ambient-beds.ts`, written by
  `scripts/export-sound-previews.ts --ambient`. Exporting rather than setting
  `audio.volume` in the player matters because iOS Safari ignores `volume`. The
  sound-effect previews from task 34 are unchanged.
- **Chant is a CC0 recording**, the operator's pick from four Freesound candidates:
  "Monk Chant Temple" by szegvari (#545055). It is processed like the other recordings:
  high-pass 80 Hz, low-pass 4 kHz to set it behind the voice, and a 30 s equal-power
  loop. ElevenLabs candidates weren't possible, because the key lacks the
  `sound_generation` permission.
- **On the card, None takes a full row**, so the six beds fill a 2×3 grid with no
  orphan tile.
- **Space's mix volume is 0.5, the same as the other beds**, and its file sits at
  BED_LUFS like theirs. Its swells make one silence louder than the next, but averaged
  over a whole cycle it sits level with the other beds in the same mix (see Outcome).

## Acceptance criteria

- [x] No `brown-noise` references remain except the legacy-null test, which shows a saved
      `brown-noise` re-renders as narration alone
- [x] A `space` bed: ethereal, slow-evolving, distinct from the drone, seamless over a
      long silence, synthesized, at the other beds' in-mix level
- [x] A 30 s space preview and a mix under narration in `test-output/`
- [x] Every ambient preview plays at about -37 LUFS, set by one constant
- [x] A `chant` bed, picked by the operator from 4 to 6 candidates
- [x] Snapshot rebuilt and one short real render under space (and chant)
- [x] Lint, tsc, tests and build pass
- [ ] Operator: listen to the final space files (the reverb changed after approval, see
      Outcome), set `AUDIO_SANDBOX_SNAPSHOT_ID` in Vercel Production and redeploy

## Outcome (2026-10-22)

**What changed**

- `scripts/ambient-beds.ts`: brown noise removed; the `space` recipe and the `chant`
  recording added. `AMBIENT_PREVIEW_LUFS = -37` and `PREVIEW_GAIN_DB` are the one place
  the preview level is set. `RECORDED_BED_DIR` is `scripts/ambient/`. `lossless` beds
  render to FLAC in the snapshot. `bedFile` is split into `snapshotFile` and
  `previewFile`.
- `scripts/ambient/`: rain, ocean and forest moved here from `public/` (same checksums),
  plus `chant.mp3`.
- `public/sounds/ambient/`: all six previews re-exported at the in-mix level.
  `brown-noise.mp3` is gone.
- `src/lib/meditation/ambience.ts`: `space` (`space.flac`) and `chant`, both at volume
  0.5. The prompt and `offerAudio`'s enum derive from `AMBIENCE_IDS`, so they list them
  without further edits.
- `scripts/create-sandbox-snapshot.ts` and `scripts/export-sound-previews.ts` read the new
  locations. `scripts/test-audio-generation.ts` takes `--ambience <id>`.
- `ambience-picker.tsx`: None spans the row.
- Tests: the catalog test checks snapshot paths per bed kind, recorded checksums in
  `scripts/ambient/`, and the preview constant. `workflow.test.ts` has the legacy test:
  a saved `brown-noise` renders with `backgroundMusic: null` and completes.

**Evidence**

- Preview loudness (integrated, ffmpeg ebur128), before and after:

  | Preview | Before | After |
  |---|---|---|
  | rain | -28.0 | -37.9 |
  | ocean | -28.4 | -37.9 |
  | forest | -28.4 | -37.8 |
  | drone | -28.0 | -37.0 |
  | space | n/a | -37.5 |
  | chant | n/a | -37.8 |

  The MP3 re-encode at this level costs a few tenths of a dB on the recordings.
- Snapshot `snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8` (FFmpeg 7.0.2), measured inside a sandbox
  booted from it: chant, forest and ocean at -28.4 LUFS; drone, rain and space at -28.0.
  Its `space.flac` matches the local render to 2.7e-5. The first build
  (`snap_hua90qgxDhRGZig7FmZvbsxmAVVe`, the afir space at -47.6) has been deleted.
- Space loop: exactly periodic over 90 s (period-to-period difference 7e-9). The step
  across the seam is 0.0027, against a 99.9th-percentile step of 0.0044 within the file.
- Chant loop: exactly 30.00 s. The seam step is 0.0016, against 0.0061 within the file.
- Offline mix harness: the real `bedMixFilter`, `say` narration at -21 LUFS, beds at
  their catalog volume, averaged over a 90 s silence. Rain -34.1, ocean -34.4, forest
  -34.4, drone -34.0, space -34.0, chant -34.4 LUFS. The harness reads 2–3 dB above the
  operator's real-render figures for every bed alike, so space and chant sit with the
  others.
- Real renders on the new snapshot (`test-audio-generation.ts --ambience`, 81 TTS
  characters each, ALL PASSED). In the 12 s silence the bed sits at -35.6 LUFS (space) and
  -35.0 (chant), with narration about -20 to -21.
- Browser (localhost:3044, alice, an existing studio chat): the card shows None on a full
  row, then Rain/Ocean, Forest/Soft drone, Space/Chant, with no horizontal overflow. The
  space (90 s) and chant (30 s) previews load. Checked in dark at desktop width, then in
  light. 390px could not be emulated, because the window would not resize. The picker is
  below the 448px three-column breakpoint there too, so it gets the same two-column grid.
  `impeccable detect` on the picker: no findings.

**For the operator**

1. Listen to the final space bed. The operator approved the afir version; this one
   differs in its tails (see Decisions):
   - `test-output/space-preview-30s.mp3` and `test-output/space-offline-mix.mp3`: final.
   - `…-approved-afir.mp3`: the version you heard, for an A/B.
   - `test-output/test-meditation-space.mp3` and `test-meditation-chant.mp3`: the real
     renders.
2. Set `AUDIO_SANDBOX_SNAPSHOT_ID=snap_wDa4k6VWCQ7LakGT4mLq9kTAiWp8` in Vercel Production
   and redeploy. Until then, space and chant render as narration alone. Delete the old
   snapshot (`snap_43Xz3L2sxNGvK1hTk6AloMDdNcJH`) once production is verified.
3. Check the card at 390px on a phone.
4. Optional: the snapshot installs `ffmpeg-static@latest`, so a future major can change
   what any recipe renders, as afir showed. Pinning it is a separate change.
