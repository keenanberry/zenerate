# Download Button

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 02 (audio URL strategy decides whether this needs a signing route)

## Why this blocks ship
Users expect to save their generated meditations to listen offline on a phone (during a plane ride, a commute without signal, a walk). Without a download button, the product feels incomplete for its primary use case.

## Acceptance criteria
- [ ] Download button visible next to or on the audio player on `/meditation/[id]`
- [ ] Clicking downloads the MP3 with a sensible filename (`<meditation-title>.mp3`, slugified)
- [ ] Works on desktop and mobile (iOS Safari in particular handles `<a download>` differently — verify)
- [ ] Only owner sees it, OR public-meditation viewers also see it — decide and document
- [ ] Download respects signed URL expiry (if storage is private) — server action refreshes URL if needed

## Implementation notes
- The `meditation-audio` bucket stays **private** — see 02 and 07. Do not make it public to
  simplify this; there are no `storage.objects` policies, and public access would undo the
  privacy fix in task 02.
- A download route must go through an **authorized fetch**, never by signing a path built
  from a route param. `@/lib/audio/signed-url`'s `hydrateAudioUrl`/`hydrateAudioUrls` sign
  with a service-role client and perform no authorization of their own — an ESLint rule
  (`no-restricted-imports` in `eslint.config.mjs`) now restricts importing that module to
  `src/lib/meditation/actions.ts` specifically because a naive `/api/audio/[id]/download`
  that imported it directly and signed `${id}.mp3` from the URL would hand any caller any
  user's private audio. Route the download through the same fetchers the six existing
  callers use (e.g. call `getMeditation(id)` from `actions.ts`, which already returns a
  freshly-signed `audio_url` after an RLS-bound row fetch) and redirect/stream from that,
  rather than reaching into signed-url.ts from a new call site.
- Slugify the meditation title to avoid weird characters in filenames. Lightweight slugify library or hand-rolled regex.
- iOS Safari ignores `<a download>` for cross-origin URLs — route-handler + `Content-Disposition: attachment` header is the reliable approach.

## Open questions
- Allow downloading other users' public meditations? (Default: yes — public means public.)
