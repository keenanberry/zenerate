# Download Button

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
Users expect to save their generated meditations to listen offline on a phone (during a plane ride, a commute without signal, a walk). Without a download button, the product feels incomplete for its primary use case.

## Acceptance criteria
- [ ] Download button visible next to or on the audio player on `/meditation/[id]`
- [ ] Clicking downloads the MP3 with a sensible filename (`<meditation-title>.mp3`, slugified)
- [ ] Works on desktop and mobile (iOS Safari in particular handles `<a download>` differently — verify)
- [ ] Only owner sees it, OR public-meditation viewers also see it — decide and document
- [ ] Download respects signed URL expiry (if storage is private) — server action refreshes URL if needed

## Implementation notes
- If the `meditation-audio` bucket is public, a plain `<a href={audioUrl} download={filename}>` works.
- If the bucket is private with signed URLs, the download link must be freshly signed; consider a route handler (`/api/meditation/[id]/download`) that generates a signed URL on demand and 302s to it.
- Slugify the meditation title to avoid weird characters in filenames. Lightweight slugify library or hand-rolled regex.
- iOS Safari ignores `<a download>` for cross-origin URLs — route-handler + `Content-Disposition: attachment` header is the reliable approach.

## Open questions
- Allow downloading other users' public meditations? (Default: yes — public means public.)
