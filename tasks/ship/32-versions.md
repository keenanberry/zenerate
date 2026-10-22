# Versions, Replace-or-Keep, Continue in Chat

**Status:** In review
**Priority:** Phase 5, Wave B. Rarely used, so keep it simple.
**Phase:** 5 (studio, second wave)
**Depends on:** 30, 31
**Skill:** `zenerate-design`; `audio-pipeline` (this task touches `workflow.ts`, which runs in the Vercel function, **not** the sandbox. The snapshot stays as it is)
**Spec:** `docs/superpowers/specs/2026-10-20-agentic-studio-design.md`

## Why

You listen, it feels different from how it read, and you come back to add a section. The
original stays playable until the new version is ready, and then you choose whether to
keep it.

## Scope

- **Promotion** (in `workflow.ts`'s completion step), when a render finishes with
  `draft_script` set:
  - Archive the current script, audio path, voice and metadata into `meditation_versions`.
  - Promote `draft_script` to `script`, set the new audio path, and clear `draft_script`.
  - Status becomes `completed`.
  - A failed render leaves the current version and the draft untouched.
- **Replace-or-keep card:** in the chat, after a draft render completes, ask "Keep the
  previous version, or replace it?" **Replace** deletes the archived row **and its
  storage object**. **Keep** does nothing.
- **Version switcher:** on the meditation page, owner only, shown when archived versions
  exist. Selecting one plays its audio (signed through the same hydrator) and shows its
  script. Owners can delete an archived version. A public visitor always sees only the
  current version.
- **Continue in chat:** a link on the owner's meditation page to `/create/[chatId]`.
  Meditations with no chat (none after the wipe) hide it.
- **Keep the public page on the current version during a draft render.** As of task 31,
  `/api/audio/generate` sets `status = 'processing_audio'` for a draft render, and
  `markFailed` sets `'failed'` when one fails. So a public meditation mid-revision shows
  "processing" or "failed" instead of its existing audio. A draft render must leave the
  public-facing state alone: track it separately (for example, a draft render status), or have
  the page keep playing `audio_path` whenever one exists. On failure, restore the prior status.
  The owner's chat card still shows progress and failure.
- The public page never renders `draft_script`. Note: the column is readable through
  `anon`'s table grant on `meditations`. That is acceptable because the script is public
  anyway; say so in the Outcome rather than adding column grants.

## Acceptance criteria

- [x] Workflow tests:
  - A draft render's completion archives exactly one version and promotes the draft.
  - A failed draft render changes nothing.
- [x] Replace deletes the archived row and its object; a follow-up storage `list` proves
  the object is gone.
- [x] During a revision, the public page shows the old script and audio, checked signed
  out with `curl`.
- [x] The switcher shows only for the owner, and only when archived versions exist.
- [x] Continue in chat opens the conversation with its history.
- [x] `docs/architecture.md` describes draft promotion and archived versions, and its
  status section notes that `draft_script` can be set alongside `completed`.
- [x] (Operator, added) Two renders of one meditation produce two different paths under
  `<user_id>/<meditation_id>/` (unit test).
- [x] (Operator, added) Deleting a meditation removes its storage folder, verified against
  local Supabase storage.

## Outcome

### What changed

**Per-user, per-render audio paths (done first).**
- `uploadAudio(userId, meditationId, buffer)` in `src/lib/audio/storage.ts` writes
  `<user_id>/<meditation_id>/<uuid>.mp3` with `upsert: false`. The UUID is drawn inside the
  upload, so a retried `generateAndUpload` step writes a new file instead of failing on a
  taken name. `fetchAndParse` now reads `user_id` for the folder.
- `removeAudio(paths)` and `removeMeditationAudio(userId, meditationId, extraPaths)` (lists
  the folder, removes everything in it plus any flat legacy paths).
- `deleteMeditation` reads the archived versions' paths, deletes the row with
  `.eq("user_id", user.id).select()`, and only when a row really came back removes the
  folder and any flat paths. A storage failure there is logged, not thrown: the meditation
  is gone either way, and a leftover file sits in the owner's folder.
- A replaced version's file is deleted by Replace / the switcher's delete
  (`deleteMeditationVersion`). Promotion does **not** delete the outgoing file: it is the
  archived version's audio until the owner chooses.
- Readers are unchanged; they sign whatever `audio_path` holds, so flat paths keep playing.
- **Not in the sandbox snapshot.** `generate-audio.ts` imports only ElevenLabs, ffmpeg,
  node built-ins and `loudness.ts`, and writes `output.mp3` locally; `storage.ts` is
  imported by `workflow.ts` and the meditation actions, which run in the Vercel function.
  `git diff origin/main -- src/lib/audio/generate-audio.ts src/lib/audio/loudness.ts
  scripts/` is empty. The snapshot ID is unchanged and needs no rebuild.
- `docs/runbooks/operator-data-wipe.md` (count, list and orphan queries by prefix; checked
  against local Postgres) and `tasks/post-ship/account-deletion.md` describe the layout.

**Draft renders keep the public version (the scope note).**
- Migration `20261022000032_draft_status.sql`: a nullable
  `meditations.draft_status text check (in ('processing','failed'))`. No default, so every
  existing row reads as "no draft render". `add column if not exists`, because I added the
  column to the shared local database by hand before the "only 36 changes the local schema"
  rule arrived (I then removed my row from `supabase_migrations.schema_migrations`, so 36's
  `migration up` sees nothing unknown).
- `/api/audio/generate`: a `completed` meditation with a `draft_script` is a draft render.
  It compare-and-sets `draft_status` (`null`/`failed` → `processing`, with
  `.eq("status","completed")`) and never touches `status`. Voice is not written to
  `settings` at the start (settings describe the current version). A failed start puts
  `draft_status` back. A free retry is accepted from `draft_status = failed`.
- `markFailed` reads `draft_status`: a draft render becomes `draft_status = failed` and
  `status` stays `completed`; anything else is `failed` as before.
- `writeScript` refuses while `draft_status = 'processing'`, like `processing_audio`.
- `getAudioOffer` folds `draft_status` into the card's status and reports `draftRender` and
  `latestVersionId`; `AudioProcessingStatus` takes `draft` and polls `draft_status`
  (`getMeditationStatus` now returns it). The owner's card shows progress and failure, and
  its free retry resends the voice from the answered tool output.

**Versions.**
- Promotion (`promoteDraft` in `workflow.ts`, inside the `finalize` step) archives the
  current script, `audio_path`, `settings.voice` and `generation_meta` into
  `meditation_versions`, then promotes the draft, the new audio, meta and voice, and clears
  `draft_script` / `draft_status`. Idempotent for a step retry (skips the archive when that
  `audio_path` is archived; returns when `draft_script` no longer matches).
- **Replace-or-keep** (`src/components/studio/replace-or-keep.tsx`, mounted in
  `audio-card.tsx`, not in `parts.tsx`): shown under the inline player when the card has
  watched a draft render finish. **Replace** → `deleteMeditationVersion` (RLS-bound delete
  returns the row, then the object is removed). **Keep** does nothing.
- **Switcher** (`meditation-versions.tsx` server wrapper + `version-switcher.tsx`), mounted
  at the end of the meditation page for the owner. Picking a version plays it (signed by
  `getMeditationVersions` through the same hydrator) with its script under its own
  `ScriptPlaybackProvider`, downloads via `/api/audio/[id]/download?version=<id>` (new
  `getMeditationVersion`, owner-only), and deletes with a two-step confirm.
- **Continue in chat** (`continue-in-chat.tsx`, `getMeditationChatId`), mounted in the
  header's action row for the owner; renders nothing without a chat.
- `getMeditation` now blanks `draft_script` for non-owners (see below).

### Evidence

- `workflow.test.ts` (5, an in-memory supabase-js fake; `storage.ts` runs for real):
  promotion archives exactly one version with the old script/audio/voice/meta and promotes;
  a failed draft render leaves the row byte-for-byte except `draft_status` → `failed`, no
  version, no upload; a first render archives nothing; a first render's failure sets
  `failed`; two renders give two different `user-1/med-1/<uuid>.mp3` paths and never
  upsert.
- `route.test.ts` (+3): a draft render's CAS values and filters, no `status`/`settings` in
  the update; a second draft render while `processing` gets 409 before reserving; a free
  retry from `draft_status = failed`; a failed start reverts `draft_status` only.
  `tools.test.ts` (+1): `writeScript` refuses during a draft render. Download route (+2):
  version download through `getMeditationVersion`, 404 when not the caller's.
- **Real local Supabase (Postgres + Storage), a throwaway vitest file (not committed)
  running the real workflow (Sandbox faked), `deleteMeditationVersion` and
  `deleteMeditation` as alice:** first render path
  `1111…/d0dd8510…/3726b55c….mp3`, second `1111…/d0dd8510…/86575254….mp3`; the list
  after both had both files and one version row; a failed draft render left
  `{status: completed, draft_status: failed}` with script, audio and draft unchanged;
  after Replace the list held only the current file; `deleteMeditation` removed the row and
  the folder's list came back `[]`.
- **Browser (`next dev`, signed in as alice), demo meditation `c53adebc…`, public, with one
  archived version and a chat:**
  - Signed out, `curl` during a draft render (`draft_status = processing`): current script
    marker and current audio path present, badge "completed", the draft marker, the old
    version, "Earlier versions" and "Continue in chat" absent.
  - **Found and fixed:** before the `getMeditation` change, the draft text was in the
    public page's HTML (the row is serialized whole into `AudioSection`'s client payload).
    It was there on `main` too, since task 31.
  - Owner page: "Continue in chat" → `/create/568debd8…`, which opened with the full
    history. The switcher played the archived audio and showed its script; its download
    returned 135102 bytes (the old file) and the current download 101070 (the current one).
  - The chat card, with `draft_status = processing`: "Generating audio…". I then ran the
    real workflow on it; the card turned into the player plus "Keep the previous version,
    or replace it?". Replace removed the version row and its object (storage list showed
    only the new and older files). A second draft render, failing: the card showed "Audio
    generation failed" while signed-out `curl` still showed badge "completed" and the
    current audio.
  - The switcher's "Delete for good" removed the last version and its file, and the card
    disappeared.
  - Design: dark desktop, then dark 390 px (iframe; `scrollWidth` 390 = `clientWidth`, the
    header wraps "Add to collection" to a second line), then light. Impeccable detect on
    the changed components: `[]`.
- `npm view workflow dist-tags` (2026-10-21): `latest 5.2.3`; installed `^5.2.0`, current
  major.

### Decisions

- **A column, not status juggling.** A draft render's state is `draft_status`, so `status`
  keeps meaning what the public sees. Nothing reads it but the owner's card and the route.
- **Replace-or-keep asks only on a card that watched the render finish.** Keep does nothing
  (per scope), so there is nothing to persist; a card reloaded later does not ask again,
  and the switcher covers a later delete.
- **The draft is blanked for non-owners in `getMeditation`** rather than with column grants.
  The column is still readable through `anon`'s table grant on `meditations`, which the
  scope accepts: a revision of a public script is no more private than the script.
- `settings.duration` / `settings.type` are still not carried on promotion (31's note):
  nothing stores the draft's target, and adding that is out of scope.
- Only the newest archived version is offered for Replace; older ones are the switcher's.

### For the operator

- **The migration must reach production no later than the deploy.** Both run on merge
  (Supabase GitHub integration, Vercel). If the code lands first, every query that selects
  `draft_status` fails until the column exists: `/api/audio/generate` answers 404, the
  chat's `writeScript` says the meditation can't be found, and the audio card can't load.
  Check `select draft_status from meditations limit 1` succeeds right after the merge, and
  avoid using the studio until it does. The column is additive and nullable, so existing
  rows are untouched.
- One real render on a preview or production deploy: a first render lands under
  `<your user id>/<meditation id>/`; then revise in chat, Make audio, confirm the public
  page keeps the old audio during the render, the card asks keep-or-replace, and Replace
  removes the old file in **Storage → meditation-audio**.
- No snapshot rebuild; `AUDIO_SANDBOX_SNAPSHOT_ID` unchanged.
- Production meditations made since the 2026-10-21 wipe and before this deploys have flat
  `<id>.mp3` paths. They keep playing; deleting the meditation removes the flat file too.
