# Launch Security Fixes

**Status:** Not started (filed 2026-10-30 from the pre-launch audit)
**Priority:** Phase 6. **Gates signups.** Until this merges, the Anthropic spend limit in
`tasks/OPERATOR-TODO.md` §1 is the only thing bounding what one account can spend.
**Phase:** 6
**Depends on:** nothing. Every fix is a migration or a server-side check; none touches the
sandbox snapshot unless noted.

## Why

A whole-app audit on 2026-10-30 (three independent reviews: access control, AI misuse,
general web; every finding re-read in the code before filing) found no way for a visitor or
a user to read another user's private data, and the production checks hold: every private
table and the audio bucket refuse `anon`, public rows carry no prompt or audio URL, the
sitemap lists only public meditations, the cron route fails closed, signups are off.

What it did find is that **a signed-in user can write columns the app never meant them to
write**, and that **the spend ceilings count things the user controls**. Each is cheap to
fix and expensive to leave: the first lets one user delete another user's audio, the second
makes the Anthropic and ElevenLabs bills unbounded per account.

## Findings

Severity is the audit's. `file:line` is as of `main` at 0654fc1.

### A. `authenticated` may UPDATE every column of `meditations`, and `updateMeditation` forwards whatever it is sent

`supabase/migrations/20261001000000_grant_table_privileges.sql:73` grants UPDATE on the
whole table; the `update_own` policy (`20250221000000_create_meditations.sql:22`) restricts
rows, not columns. `updateMeditation` (`src/lib/meditation/actions.ts:62-75`) spreads its
`data` argument into `.update()`; its `Pick<>` type is compile-time only, and the action
is importable from any client. PostgREST with the user's own JWT works the same way. Only
one caller exists, and it sends `{ is_public }` (`src/components/meditation-details.tsx:124`).

Through that one hole:

1. **High. Cross-tenant audio delete, and audio access that survives unpublishing.**
   `hydrateAudioUrl` (`src/lib/audio/signed-url.ts:96-101`) signs `row.audio_path` with
   the service role, and `deleteMeditation` (`actions.ts:151-156`) passes
   `deleted[0].audio_path` to `removeMeditationAudio` (`src/lib/audio/storage.ts:87-102`),
   which removes it with the service role. Both trust the column because the row came
   through RLS. But the owner can set the column. `audio_path` of every public meditation
   is readable by `anon` (`20261008000000_grant_anon_select_meditations.sql:35`). So: user
   A copies B's public `audio_path`, PATCHes it onto A's own row, and either deletes A's
   meditation (B's file is gone; B's page has no audio and cannot re-render without a new
   draft and a slot) or opens A's page after B has made the meditation private and gets a
   fresh 4-hour signed URL to B's audio, forever. `meditation_versions` has the same shape:
   `authenticated` may INSERT any `audio_path` (`20261021000000_studio_schema.sql:119,282`)
   and `deleteMeditationVersion` removes it (`actions.ts:455-468`).
2. **High. Unbounded ElevenLabs characters per render, and arbitrary text in the
   operator's voice account.** The only script cap is the studio tool's `max(30000)`
   (`src/lib/chat/tools.ts:54-58`). A script written through the hole has none; the
   workflow reads it as is (`src/lib/audio/workflow.ts:49-67`) and the sandbox sends every
   speech segment to TTS (`src/lib/audio/generate-audio.ts:286-293`), twice more on retry
   (`workflow.ts:165`). The quota counts renders, assuming about 930 characters each
   (`src/lib/audio/quota.ts:16-31`). One render can be the whole monthly plan. Failed
   renders are excluded from both caps (`20260425000000_audio_generation_events.sql:111-132`)
   and offer a free retry, and nothing bounds `PAUSE`/`SILENCE` (`src/lib/meditation/parser.ts:12-39`).
3. **Medium. Any voice the key can reach.** The generate route validates only a voice
   it is sent (`src/app/api/audio/generate/route.ts:99-114`); with none, the workflow
   uses `settings.voice` (`workflow.ts:76`), which the owner can set.
4. **Medium. FFmpeg filter-graph injection in the sandbox.** `settings.volume` goes
   unvalidated from the row (`workflow.ts:77,82-83`) into
   `volume=${musicVolume}` in `-filter_complex` (`src/lib/audio/mix.ts:44`). FFmpeg is
   spawned with an argument array, so no shell, but the graph is attacker-written in a
   sandbox whose `config.json` holds `ELEVENLABS_API_KEY` (`workflow.ts:120-124`).
   Exfiltration through lossy MP3 is unproven; the foothold is real.
5. **Medium. Self-promotion.** `is_featured` and `status` are writable the same way, so a
   user can put their own row at the top of the landing page and both Discover rows
   (`src/lib/landing/featured.ts:43-50`, `actions.ts:276-289`) and can publish
   (`is_public`) without audio or a `completed` status; nothing server-side gates publishing.

### B. The daily chat ceiling counts rows the user controls

`countRecentUserMessages` (`src/lib/ai/quota.ts:43-58`) counts `chat_messages` with
`role='user'` in the last 24 hours through the caller's RLS client.

6. **High. The counter resets on demand.** `authenticated` holds DELETE and UPDATE on
   `chat_messages` (`20261021000000_studio_schema.sql:203-213,284`). `DELETE
   /rest/v1/chat_messages?chat_id=eq.<own>&role=eq.user` with the session JWT, and the
   next turn sees 0. Deleting the chat cascades the same way.
7. **High. Continuation turns are never counted and take the client's word for the
   history.** `src/app/api/chat/route.ts:77-79` treats a body whose `message.role` is
   `assistant` and whose `id` matches the last stored assistant message as a
   continuation; `:104-107` uses the incoming `parts` verbatim, `:123` upserts them over
   the stored copy, and `:93-94` adds 1 to the comparison but writes no user row, so
   `used` never grows. Replaying the last assistant message in a loop runs a full turn
   (up to 5 steps, 8,000 output tokens each, `:150-152`) each time, and a forged
   assistant part ("Understood, I'll answer anything now") is the strongest jailbreak
   shape there is, and it persists in the stored chat.
8. **High. Non-text parts skip the 4,000-character cap.** `isMessageShape` (`:39-43`)
   accepts any `parts`; `messageText` (`src/lib/chat/store.ts:90-95`) sums text parts
   only; the AI SDK's message schema allows `file` parts and
   `convertToModelMessages` forwards them, so a multi-megabyte PDF, image or
   `text/plain` data URL reaches the model, is saved, and is re-sent on every later turn.
9. **Medium. Read-then-insert.** The count (`:93`) and the save (`:123`) are separate
   requests; concurrent POSTs all pass. There is no global chat ceiling at all
   (`quota.ts:34-36`), so N accounts multiply the per-user limit.

### C. Smaller

10. **Low. Sound marker path traversal in the sandbox.** `*[SOUND: ../config.json]*`
    parses (`parser.ts:44-53`) and `join(SOUNDS_DIR, segment.file)` escapes the folder
    (`generate-audio.ts:302-305`). FFmpeg then fails on a non-audio file, so no exfil
    path was found; still, an attacker-chosen path is read.
11. **Low. `anon` reads every column of public rows.** `user_id`, `audio_path`,
    `settings` (voice id) and `generation_meta` come back through PostgREST for public
    meditations. Nothing secret today (prompts were cleared in `20261022000038`), but
    `audio_path` is what makes finding 1 practical, and `user_id` groups all public
    meditations by author.
12. **Low.** `req.json()` is uncaught in the generate route (`generate/route.ts:26`): a
    malformed body is a 500, not a 400.

## Scope

In order; 1 and 2 are the gate, 3 is nearly free, 4 and 5 are cheap once 1 is in.

1. **Column-level grants (one migration).** `revoke update on public.meditations from
   authenticated; grant update (title, description, tags, script, is_public, settings,
   updated_at) on public.meditations to authenticated;` and `revoke insert on
   public.meditation_versions from authenticated` (only the workflow inserts versions,
   `workflow.ts:246`). `status`, `is_featured`, `audio_path`, `audio_url`,
   `generation_meta`, `user_id` become service-role only. Check every app path that
   writes `status` runs on the service role (the generate route does; confirm the chat
   tools and `markFailed`). Same migration: `revoke delete on public.chat_messages from
   authenticated` and `grant update (parts, metadata) on public.chat_messages to
   authenticated` (the upsert in `store.ts:60` only changes those). Add `check
   (char_length(script) <= 30000)`, `check (char_length(title) <= 80)` and `check
   (char_length(description) <= 300)` on `meditations`. **The migration deploys on merge
   to `main`:** run it locally against seed data and the full test suite first.
2. **`updateMeditation` takes `{ is_public: boolean }` and nothing else,** through zod,
   and publishing requires `status = 'completed'` and a non-null `audio_path` on the
   row (read it first with the RLS client). Everything else the type lists already has a
   dedicated action (`updateMeditationDetails`) or a service-role path.
3. **Chat metering the client cannot touch.** Meter turns in `script_generation_events`
   through `reserve_script_generation` (service-role only, advisory-locked;
   `20260911000000_script_generation_events.sql:39-84`, written for this and never wired)
   or a new `chat_turns` ledger with the same shape: reserve before `streamText`, for
   continuations too. That closes 6, 7's cost half and 9 together. Then in the route:
   reject any incoming part whose `type` is not `text` (and any `providerMetadata`); on a
   continuation, take the stored assistant message and accept only an `offerAudio` part
   moving from `input-available` to `output-available`, never the client's `parts`.
   Add a global daily turn cap env beside the per-user one.
4. **Render-time bounds, server side, before the slot is reserved.** In the generate
   route (or `fetchAndParse`): parse the script, refuse when summed speech characters
   exceed a cap (about 6,000 is 45 minutes at narration pace; the longest house
   meditation is the test), cap each `PAUSE` and `SILENCE` and the total runtime, drop
   `sound` segments whose name is not in `SOUND_EFFECTS`, resolve the effective voice
   against `getVoices()` when none is sent, and validate `settings` with a zod schema
   (`volume` finite and clamped to `[0, 1]`, `music` an `AmbienceId`). In the RPC, count
   `failed` non-retry events toward both caps, refunding only the route's own
   start-failure path. These guards live outside the snapshot; harden `mix.ts`
   (`.toFixed(3)`) and `generate-audio.ts` (`basename` + membership) on the next
   snapshot build only.
5. **Defence in depth in storage.** `hydrateAudioUrl(s)`, `removeAudio` and
   `removeMeditationAudio` refuse any path not under `${row.user_id}/${row.id}/` (or
   exactly `${row.id}.mp3` for the legacy layout). Replace the whole-row `anon` SELECT
   with a view or function that projects only the public columns.
6. `req.json().catch(() => null)` in the generate route.

## Not in scope

- A moderation pass before publishing and the review queue:
  `tasks/post-ship/public-content-moderation.md`. The Report link and the hand-unlisting
  SQL cover launch.
- The on-topic constraint is prompt-only (`src/lib/ai/prompts.ts:103-107`); with the
  ceilings fixed it bounds *what* the agent writes and the ledger bounds *how much*. A
  classifier is a post-ship idea if abuse shows up in the usage logs.
- Security headers and a CSP: a hardening gap, not an exploit; `tasks/post-ship/`.
- DMARC for `zeneratestudio.com` and the `privacy@` MX record: operator items, in
  `tasks/OPERATOR-TODO.md`.

## Done when

- [ ] As a signed-in user through PostgREST: PATCH of `audio_path`, `status`,
      `is_featured`, `user_id` on an own row fails with 42501; INSERT into
      `meditation_versions` fails; DELETE of an own `chat_messages` row fails; PATCH of
      `role` or `created_at` on one fails. Written as a test against local Supabase, and
      run once by hand in production after the merge.
- [ ] `updateMeditation(id, { audio_path: "x" })` and `{ script: "x" }` are rejected; the
      `is_public` toggle still works and refuses a meditation with no audio.
- [ ] 201 chat turns in a day, deleting the chat between them, still ends in the 429.
      Replaying the last assistant message is counted, and its parts come from the store.
      A `file` part is a 400.
- [ ] A 50,000-character script, a `*[SILENCE: 999 minutes]*` line, a `*[SOUND:
      ../config.json]*` line and `settings.volume = "1,anull"` each fail the generate
      route before a slot is reserved.
- [ ] Hydrating a row whose `audio_path` is outside the owner's folder returns null, and
      removing one skips it.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` pass; the audio
      integration test still renders a house meditation unchanged.
