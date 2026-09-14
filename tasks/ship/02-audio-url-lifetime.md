# Audio URL Lifetime & Privacy

**Status:** Done
**Priority:** Ship-blocker
**Blocks:** 13 (download button needs to know whether URLs are signed on demand)

## Why this blocks ship

`src/lib/audio/storage.ts:39-46` mints a signed URL valid for one year and writes it into
`meditations.audio_url`:

```ts
.createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year
```

Two separate defects fall out of that:

**It expires.** Every meditation's audio silently 404s one year after generation. Nothing
re-signs it, nothing detects it, and the failure surfaces as a broken player long after
anyone would connect it to this line.

**It leaks.** A signed URL is a bearer token. Anyone holding the link can fetch the audio
regardless of `meditations.is_public` or any RLS policy — RLS governs the *row*, not the
object in storage. So a private meditation's audio is effectively public to anyone who
obtains the URL, and the URL is stored in a column that any future feature might expose.

## Acceptance criteria

- [ ] `meditation-audio` bucket confirmed private in both local and production Supabase
- [ ] `uploadAudio()` stops returning a signed URL; it stores the storage **path** (`<meditationId>.mp3`), not a URL
- [ ] `meditations.audio_url` either repurposed to hold the path or replaced by an `audio_path` column via migration — pick one and be consistent
- [ ] A server-side helper mints a short-lived signed URL (target: 1 hour) at read time, after verifying the caller owns the meditation or it is public
- [ ] `/meditation/[id]` passes a freshly-signed URL to the player on each render
- [ ] Migration backfills existing rows from stored URLs to paths (parse the path out of the existing signed URL)
- [ ] Verify a private meditation's signed URL 403s when requested by a signed-out client after expiry
- [ ] Verify a public meditation still plays for a signed-out visitor

## Implementation notes

- The signing helper belongs in `src/lib/audio/storage.ts` next to `uploadAudio`, but the *authorisation* check must happen against the request's user — use `createClient()` from `src/lib/supabase/server.ts`, not the service-role client, so RLS does the row check for you.
- One hour is generous for a page session; the player holds the URL in memory once loaded. A meditation that plays for longer than the URL's lifetime is fine — the fetch already happened.
- Wavesurfer may re-request the audio on seek. Verify a seek after 1 hour of an open tab doesn't break; if it does, either lengthen the TTL or re-sign on demand from the client via a small route handler.
- Task 13 (download) should use the same helper rather than a second signing path.

## Alternative considered

Make the bucket **public** and store a permanent public URL. Simpler, no signing, no
expiry, and the download button becomes a plain `<a download>`. The cost is accepting
that private meditations' audio is link-accessible to anyone. For a single-user app that
is a defensible trade; it stops being defensible as soon as other people store personal
meditations. Rejected on that basis — but if implementation proves fiddly, this is the
documented fallback, and the decision should be recorded rather than drifted into.
