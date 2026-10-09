# Handoff — Phase 2 Closeout: Public Content, Legal, Sound, Voices

**Written:** 2026-10-09
**Branch:** `main` at `0d97b5c` (PRs #22–#24 merged). **#25 open.**
**Supersedes:** `phase-2-live-and-hardened.md`

---

## What we set out to do

Resume from the Phase 2 handoff and clear every ship task an agent can do without new
accounts. All of them are done. What remains is either account setup by the operator or
Phase 3.

## What's done

| PR | Task | What |
|---|---|---|
| #22 | **18b** | `/discover` + public meditations open signed out. Authed routes moved to `(app)/(authed)/`; `anon` granted SELECT on `meditations` only. Downloads stay account-only (route returns 401 with no session) |
| #23 | **15** | `/terms` (trimmed to a hobby-project version at the operator's request) + `/privacy`, linked from signup and a site-wide `SiteFooter` |
| #24 | **17** | Six sound effects + narration loudness normalized to -20 LUFS. Snapshot `snap_MXu6Sl0RX5di37AmE6j8vM7Nhz8y` |
| #25 | (new) | **Open.** Voice picker reads the operator's ElevenLabs collection; generation rejects other voices; Brittney default; chosen voice saved for retries |

Decisions and evidence are recorded in each task file's **Outcome** section
(`tasks/ship/15`, `17`, `18b`) and in each PR description. Read those before changing this work.

---

## Operator checklist — verify, don't assume

1. **Merge #25.** It's independent of everything else.
2. **`AUDIO_SANDBOX_SNAPSHOT_ID`** in Vercel Production must be
   `snap_MXu6Sl0RX5di37AmE6j8vM7Nhz8y`, and production must have been redeployed after
   setting it. It was literally `test` at the start of this session. Unconfirmed since.
3. **`anon` grant in production:** run `curl` with no cookies on a public meditation's URL.
   `permission denied` means the 18b migration didn't apply. Local Supabase can't
   verify this.
4. **First real production meditation with audio.** No end-to-end production generation
   has run yet. Listen for the sounds and the narration level. Check that the picker loads
   all nine voices, which requires the production ElevenLabs key to have voices read access.

---

## What's left

### Phase 3 (agent work, unblocked; the operator may start here)
Start with **19 (repo skills)**. It keeps 20–23 consistent. See `tasks/ship/README.md`.

### Phase 2, waiting on the operator's Resend setup
- **08 Transactional email.** Set up the `privacy@zeneratestudio.com` forwarder in the same
  sitting; both pages publish it and it currently receives nothing. **Add Resend to the
  provider list on `/privacy`** (task 08 acceptance criterion).
- **11 Password reset.** Needs 08.

### Post-ship, filed this session
- `tasks/post-ship/account-deletion.md`: deletion is email-only. **Storage doesn't
  cascade**: delete the user's `<meditation_id>.mp3` objects before deleting the user, or
  `/privacy`'s promise breaks.
- `tasks/post-ship/backup-retention.md`: `/privacy` promises 30-day backup retention;
  nothing prunes `~/backups/zenerate/` yet (no dumps exist so far).

---

## Gotchas that cost real time

- **Production keys are "Sensitive" in Vercel.** `vercel env pull` returns an 11-character
  placeholder for them. It looks like a value, but it isn't one. Ask the operator to put
  the key in `.env.local` themselves.
- **`vercel env pull` overwrites `.env.local` by default.** Pull to a scratch file and copy
  only what you need.
- **`VERCEL_TOKEN` in `.env.local` is invalid.** Blank it for any sandbox command
  (`VERCEL_TOKEN=""`) and use a `VERCEL_OIDC_TOKEN` from a scratch-file pull.
- **The snapshot bundles `generate-audio.ts` and its imports** (`loudness.ts`), plus
  `scripts/sound-effects.ts`. Editing any of them needs a rebuild. The build needs
  `SOUND_EFFECTS_SUPABASE_URL` / `SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY`, which are already
  in the operator's `.env.local` (a dedicated `snapshot-build` Supabase key). Verify a new
  snapshot with `scripts/test-audio-generation.ts`. `CLAUDE.md` has the full procedure.
- **LUFS doesn't predict how the sound effects compare by ear.** Pure tones measured about
  15 dB quieter than they sounded next to the bass-heavy gongs. Levels were set by the
  operator's ear in mock mixes. Don't "fix" them to a meter.
- **ffmpeg prints a placeholder ebur128 summary (-70 LUFS) before the real one.** The
  parser reads the last. A hand-written fixture hid this until a real run.
- **No local ffmpeg.** `npm i ffmpeg-static` into a scratch dir. `fluent-ffmpeg` exists
  only inside the sandbox, so to run a compiled `generate-audio` locally, install it in that
  scratch dir too.
- **In zsh, `$i:a` is a path modifier.** Build ffmpeg filter strings in bash or use `${i}`.
- **The chrome login form drops typing done before hydration.** Wait, then type.
- **Local sign-in without a browser:** use the password grant against local auth, then set
  the cookie `sb-127-auth-token=base64-<base64url(session JSON)>`.

## The exact next step

Ask the operator which they're doing today:
- **Phase 3:** read `tasks/ship/19-repo-skills.md`, set it `In progress`, and start.
- **Resend in hand:** task 08, then 11. Add Resend to `/privacy` in the same PR.

Either way, first ask whether operator checklist items 1–3 are done. If production audio
is still unverified, run item 4 before building on the audio work.
