# Download Button

**Status:** Done, except the iOS Safari check (needs a real device)
**Priority:** Ship-blocker
**Depends on:** 02 (audio URL strategy decides whether this needs a signing route)

## Why this blocks ship
Users expect to save their generated meditations to listen offline on a phone (during a plane ride, a commute without signal, a walk). Without a download button, the product feels incomplete for its primary use case.

## Acceptance criteria
- [x] Download button in the audio player's control row, next to volume. Verified rendering in a browser against a meditation with real audio
- [x] `Content-Disposition: attachment; filename="<slug>.mp3"`. Slugification is an **allowlist** (`[a-z0-9]`, everything else becomes a separator) rather than a denylist, so quotes, newlines, semicolons and path separators cannot survive into the header — 14 tests including header-injection and traversal attempts, plus the degenerate titles that would otherwise produce a bare `.mp3` (a hidden file on macOS and Linux)
- [ ] **Needs a real iPhone.** The mechanism is the documented fix — a same-origin route handler sending `Content-Disposition`, rather than `<a download>` on a cross-origin signed URL, which iOS Safari ignores — but mechanism-is-right is not device-verified
- [x] **Decided: anyone who can view the meditation can download it**, matching the open question's default. This needs no permission logic: the route calls `getMeditation`, which fetches through an RLS-bound client, so a public meditation is downloadable by anyone who can see it and a private one by nobody else. Authorization is structural rather than a check that could drift from the policies
- [x] Satisfied structurally — every request re-signs via `getMeditation`, so the 4-hour TTL is never reached and there is no expiry logic to get wrong. The signed URL is also never exposed to the client; the route fetches it server-side and streams the body back

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

## Verification

| Check | How |
|---|---|
| Unauthenticated request for a **private** meditation's audio | **404** against a real dev server with real RLS — not a mock |
| Bogus meditation id | **404**, byte-identical response, so ids cannot be enumerated |
| Button renders and points at the route | Browser, against a meditation with audio uploaded to local storage |
| Response shape, headers, streaming, failure modes | 11 route tests + 14 filename tests |

The authorized download path is verified transitively: the meditation page rendering the
player proves `getMeditation` returned a signed URL for that session, and the route calls
the same function.

Local data has no audio (every seeded meditation is `script_ready` with a null
`audio_path`), so verifying this required uploading a synthetic MP3 to local storage and
marking a meditation `completed`. Both were reverted afterwards. Worth knowing for the
next person who tries to exercise the player locally.

## Open questions
- ~~Allow downloading other users' public meditations?~~ **Resolved: yes.** Not by adding a rule, but by routing through the RLS-bound fetcher, which already encodes exactly that policy.
