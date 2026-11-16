# Move Generated Audio to Cloudflare R2

**Status:** Not started. Filed 2026-11-16 as the alternative to Supabase Pro if storage
binds first.
**Priority:** Post-ship, on a trigger (below). Not needed once on Supabase Pro.
**Related:** `src/lib/audio/storage.ts`, `src/lib/audio/signed-url.ts`,
`src/lib/audio/workflow.ts`, [Paid tier](./paid-tier.md) (where each free plan runs out),
`../ship/60-audio-egress.md`

## Why

Supabase Free holds 1 GB of storage, and storage does not reset. On 2026-11-16 the
`meditation-audio` bucket held about 0.35 GB. At 128 kbps a render costs about 0.96 MB a
minute, and renders are capped at 25 a month across all accounts
(`MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`, sized to the ElevenLabs Starter plan). So
storage grows by at most about 0.25–0.35 GB a month, which leaves roughly two months at
the full cap.

Two fixes:

- **Supabase Pro**, $25 a month: 100 GB of storage, 250 GB of egress, daily backups, and
  no pausing. No code. Section 9 of `../OPERATOR-TODO.md` already plans it once sign-ups
  arrive.
- **This task**: move the MP3s to R2 and stay on Supabase Free.

## When to do it

Do it only if storage gets tight before sign-ups justify Pro. Either trigger counts:

- Supabase → Organization → Usage shows storage at about 0.8 GB.
- The ElevenLabs plan goes past Starter, for example Creator ($22, about 100 renders a
  month), while the project is still on Supabase Free. At 100 renders a month, 1 GB lasts
  weeks.

If Pro comes first, close this task as not needed.

## Why R2, not Google Cloud Storage

Compared on 2026-11-16. Check both pricing pages before starting, since free tiers change.

| | Cloudflare R2 | Google Cloud Storage |
|---|---|---|
| Free storage | 10 GB a month | 5 GB a month, US regions only |
| Downloads (egress) | Free at any volume | A free allowance (Google's announcement says 100 GB a month; some pages still say 1 GB), then charged |
| Free operations | 1M writes, 10M reads a month | 5,000 writes, 50,000 reads a month |
| Past the free tier | $0.015 per GB-month | Charged for storage and downloads |
| Signed URLs | S3 presigned URLs | V4 signed URLs |

Both need a card on file. 10 GB holds about 10,000 minutes of audio at 128 kbps, roughly
700 to 1,000 meditations. Free egress also moves listening off the Supabase egress budget.
A full listen is a file download, and since task 60 that is what spends the 5 GB.

R2 sources: <https://developers.cloudflare.com/r2/pricing>. GCS:
<https://cloud.google.com/storage/pricing-announce>.

## What touches storage today

The move is contained:

- **`src/lib/audio/storage.ts`**: `uploadAudio` (called once, at `workflow.ts:175`),
  `removeAudio`, and `removeMeditationAudio` (which lists a meditation's folder and then
  removes it). The `ownsAudioPath` guard and the
  `<user_id>/<meditation_id>/<render_id>.mp3` layout carry over unchanged, as R2 object
  keys.
- **`src/lib/audio/signed-url.ts`**: `signAudioUrl` and `signAudioUrls` are the only
  places a URL is minted. They keep the 4-hour TTL (`AUDIO_URL_TTL_SECONDS`). An S3
  presigned URL is computed locally, so the batch signer stops making a network call.
- **The download route needs nothing.** `src/app/api/audio/[id]/download/route.ts`
  proxies whatever signed URL it is given.
- **No snapshot rebuild.** The upload runs in the workflow step, after the sandbox
  returns the buffer. `generate-audio.ts` and its imports never touch storage.
- **Not moving:** the `sound-effects` bucket. It is small, fixed, and read only when a
  snapshot is built.

The database does not change: `audio_path` stays a key, and the same key works in R2.

## Plan

1. **Operator:**
   - Create a Cloudflare account, put a card on file, and create one private R2
     bucket.
   - Make an API token scoped to that bucket with Object Read & Write.
   - Add the account id, key id, secret and bucket name to Vercel Production and
     Preview, and to `.env.local`.
   - Add a CORS rule for the site's origin. The player streams through an `<audio>`
     element, which needs no CORS, but the fallback that decodes a render without
     peaks fetches the file.
2. **Code, one PR:**
   - Put upload, remove, list-folder and sign behind one small module with an R2 and
     a Supabase implementation, chosen by an env var. Supabase stays the default.
   - Keep local dev and CI on Supabase. `supabase start` has no R2 emulator.
   - Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` against the R2
     endpoint.
   - Tests mock the S3 client, and the path guard's tests stay as they are.
3. **Copy script**, built the way `scripts/backfill-peaks.ts` is:
   - It lists every object in `meditation-audio`, then prints the count and total
     bytes. It stops unless passed `--yes`.
   - It copies each file to the same key in R2, skipping any key R2 already holds,
     so a re-run is safe.
   - Every byte it copies counts against Supabase egress (about 0.4 GB on
     2026-11-16, more by then). Run it just after a billing-cycle reset.
4. **Cutover:**
   - Run the copy, flip the env var in Production, and redeploy.
   - Run the copy once more, for renders that landed in Supabase between the two
     steps.
   - Check a public page signed out, a private one signed in, an earlier version, a
     download, and one new render.
5. **Cleanup, after a week with no problems:**
   - Empty `meditation-audio` in Supabase. That frees the storage, and it removes the
     rollback, which is flipping the env var back.
   - Remove the Supabase implementation, or keep it for local dev.

## Docs that change with it

- **`/privacy`** (`src/app/(legal)/privacy/page.tsx`): its processor list names
  Supabase for "file storage". Add Cloudflare for the audio files.
- **`docs/runbooks/account-deletion.md`**: step 2 deletes the user's folder in
  Supabase Storage and counts it with SQL. Both become the R2 prefix, deleted with a
  script, since R2's dashboard deletes objects, not folders.
- **`docs/runbooks/operator-data-wipe.md`**: the same change.
- **`tasks/post-ship/paid-tier.md`**: the storage measurement query reads
  `storage.objects`. Take R2's figure from the Cloudflare dashboard instead.
- **`docs/runbooks/backup-restore.md`**: no change. Audio is still not in the dump,
  and is regenerable from the script.

## Decisions to make before starting

- **Testing before cutover.** A dev R2 bucket (free within the same 10 GB) for a Preview
  deployment, or Production only? Check which Supabase project Preview points at first.
- **Whether to keep the Supabase implementation** after cleanup, so local dev and CI
  keep working without R2 keys.

## Done when

- New renders land in R2, and every existing file is copied there.
- Public, private, earlier-version, download and lock-screen playback all work in
  Production.
- `meditation-audio` in Supabase is empty, and Supabase usage shows the storage freed.
- `/privacy` and both runbooks name R2.
