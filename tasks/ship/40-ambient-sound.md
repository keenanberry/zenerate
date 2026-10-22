# Ambient Background Sound

**Status:** In review (PR #68). Mixed audio needs a snapshot rebuild by the operator; until
then a chosen bed renders as narration alone.
**Priority:** Phase 6
**Phase:** 6 (seed & open)
**Depends on:** 17 (sound effects, -20 LUFS narration), 31 (audio from chat), 34 (sound previews)

## Why

`generate-audio.ts` has mixed a looped, side-chain-ducked background track under the
narration since before the studio, driven by `config.backgroundMusic`. Nothing ever set it,
and no ambient files existed, so every meditation was narration over silence. A quiet bed
(rain, ocean, a drone) is what most meditation apps play under the voice, and the long
silences in a script feel empty without one.

## Decisions

- **The person picks, on the Make audio card**, next to the voice, with a **None** option
  (operator decision). The agent may suggest one, in a sentence or by preselecting it
  through `offerAudio`'s optional `ambience` input; it never insists.
- **Default:** the person's pick, else the agent's suggestion on this card, else the bed
  the last render used (`settings.music`), else None. The prompt tells the agent to suggest
  on a re-render only when the person asked for a different background, so a re-render
  keeps the last choice unless the person changes it.
- **Five beds**: rain, ocean, forest (CC0 Freesound recordings), soft drone and brown noise
  (synthesized by FFmpeg).
- **`settings.music` stores the bed's id, not its path**, and `settings.volume` its gain;
  the workflow maps the id to the snapshot path through `ambience.ts`. "none" is stored
  too, so None is remembered as a choice.
- **A draft render's choice is saved when the draft is promoted**, like its voice: until
  then settings describe the current version. The workflow gets it as an argument.
- **Recorded beds live in the repo, not the bucket.** The gongs (task 17) are fetched from
  the private production bucket. The ambient recordings are committed as
  `public/sounds/ambient/*.mp3`, which are also the card's previews, and the snapshot build
  reads those same files and verifies their SHA-256. One copy, so the preview is exactly
  what gets mixed, and the rebuild needs no bucket upload.

## Acceptance criteria

- [x] `src/lib/meditation/ambience.ts` is the one source of truth: id, label, snapshot path,
      preview URL and default volume for each bed, plus `none`
- [x] A test checks every bed has its preview file, a build recipe or recording, and that
      committed recordings match their checksums
- [x] Each bed loops seamlessly and is quiet by design (-28 LUFS files, mixed at 0.5)
- [x] Beds are baked into the snapshot at stable paths (`sounds/ambient/<id>.mp3`) by
      `scripts/create-sandbox-snapshot.ts`, and exported as browser previews to
      `public/sounds/ambient/`
- [x] The Make audio card has an ambience picker with preview play buttons, fitting the
      ~470px chat column and a 390px phone
- [x] The choice goes to `/api/audio/generate`, which validates it against `ambience.ts` and
      stores it in `settings.music` / `settings.volume`
- [x] A re-render keeps the last choice unless the person changes it
- [x] `offerAudio` takes an optional `ambience`, and the prompt has one line on suggesting it
- [x] The ducked bed sits clearly under -20 LUFS narration, checked in an offline test mix
- [x] A render with an ambience chosen on the old snapshot still succeeds, narration alone
- [ ] Operator: snapshot rebuilt, `AUDIO_SANDBOX_SNAPSHOT_ID` updated, a real render
      listened to (see Outcome)

## Outcome (2026-10-21)

**What changed**

- `src/lib/meditation/ambience.ts`: the catalog. `scripts/ambient-beds.ts`: how each bed
  is built (synth recipes; recording provenance, processing and checksums), and
  `loopFilter`, which crossfades a source's last 4 s over its first 4 s (equal-power) so
  the loop has no seam. The drone is exactly periodic over 30 s and needs no crossfade.
- `src/lib/audio/mix.ts` (new, baked into the snapshot): the bed's filtergraph. It **fixes
  a bug in the old mix**: `amix` normalizes by default, which halves each input, so the
  narration would have dropped to about -26.6 LUFS under any bed. It also fades the bed
  in over 3 s and out over the narration's last 8 s instead of cutting, and limits the sum
  at -1 dBFS. `generate-audio.ts` reads the voice track's length for the fade-out.
- `/api/audio/generate` takes `ambience`; the workflow takes it as an override for draft
  renders and promotes it with the draft; `getAudioOffer` returns the saved bed.
- The card: `ambience-picker.tsx`, a radio group of tiles in a container-query grid (two
  columns in the chat column and on a phone, three from 448px, after task 39's voice
  picker). Play buttons sit outside the labels, so hearing a bed never selects it. The
  sound-preview card's player moved to `preview-player.tsx` and both cards share it, so
  only one preview plays at a time across the chat.

**Sources** (all CC0-1.0, details in `scripts/ambient-beds.ts`): rain by speakwithanimals
(Freesound #525046), ocean by L.Finck (#636552), forest by pborel (#474342). Windows were
chosen by the steadiest momentary loudness. Freesound's originals need a login, so these
are processed from its 128k HQ previews. For a quiet bed that is fine, but the operator
could swap in originals later.

**Evidence**

- Offline test mix: the PR's `generate-audio.ts`, bundled as the snapshot build does, run
  with local ffmpeg 6.0 and a `say`-based ElevenLabs stub. Narration -20.6 LUFS during
  speech, -20.8 with any bed; beds 19.6–20.5 LU under the speech and ~14 LU under it in
  the silences; peaks -9 dBFS. Mixes, numbers and harness are on the `task-40-test-mix`
  branch.
- Old snapshot: `main`'s `generate-audio.ts` and this PR's, each with rain chosen and no
  bed file, exit 0 and output narration alone (`Ambient bed not found ... skipping it`).
- Seams: for all five files, the sample step across the loop point is below the file's
  99.9th-percentile step. The decoded lengths are exactly 30 or 40 s, because MP3 gapless
  trimming holds.
- Browser (localhost, alice): previews load in the card (30.00 / 40.00 s each) and play;
  tapping one stops any other preview, including in the sound-preview card. The suggested
  bed is preselected and marked; a saved bed is preselected on a re-render; Make audio
  posts `ambience`. The route rejects an unknown id with 400 before reserving quota.
  Checked in dark at 900px and 1440px, in dark and light at 390px, with no horizontal
  overflow.

**Found along the way:** the shared local database was missing four merged migrations
(task 32's `draft_status`, 38's prompt clear and both 38b drafts migrations), so the studio
failed with "The draft could not be read". I applied them with `supabase migration up
--local --include-all`, with no reset.

**For the operator**

1. Rebuild the snapshot: `npx tsx scripts/create-sandbox-snapshot.ts`, with a
   `VERCEL_OIDC_TOKEN` and the production `SOUND_EFFECTS_*` variables, as in the
   `audio-pipeline` skill. The log now lists `/sounds/ambient` with three beds verified and
   two rendered.
2. Set `AUDIO_SANDBOX_SNAPSHOT_ID` in `.env.local`, run
   `npx tsx scripts/test-audio-generation.ts`, then make one studio render with a bed and
   listen. Check the levels by ear, especially the drone (LUFS can misjudge pure tones; see
   task 17) and forest's birds. Each bed's level is one number in `ambience.ts`.
3. Set the ID in Vercel Production and redeploy. Delete the old snapshot once production
   is verified.
4. Delete the `task-40-test-mix` branch after review.
