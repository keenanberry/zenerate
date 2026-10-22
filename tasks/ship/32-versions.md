# Versions, Replace-or-Keep, Continue in Chat

**Status:** Not started
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

- [ ] Workflow tests:
  - A draft render's completion archives exactly one version and promotes the draft.
  - A failed draft render changes nothing.
- [ ] Replace deletes the archived row and its object; a follow-up storage `list` proves
  the object is gone.
- [ ] During a revision, the public page shows the old script and audio, checked signed
  out with `curl`.
- [ ] The switcher shows only for the owner, and only when archived versions exist.
- [ ] Continue in chat opens the conversation with its history.
- [ ] `docs/architecture.md` describes draft promotion and archived versions, and its
  status section notes that `draft_script` can be set alongside `completed`.
