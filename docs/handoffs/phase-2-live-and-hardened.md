# Handoff — Phase 2: Live in Production, Phase 2 Mostly Closed

**Written:** 2026-10-08
**Branch:** `main` at `2fdc82e`. Working tree clean, zero open PRs, 110 tests passing
**Supersedes:** `phase-1-accounts-and-deploy.md` (now historical — note it contains two wrong issue numbers, see *Corrections* below)

---

## What we set out to do

Resume from the Phase 1 handoff and get Zenerate shipped. We did more than that: **the app
is live in production** at `https://www.zeneratestudio.com`, and most of Phase 2 is closed.

## What's done

Eleven PRs merged (#9–#20). Ship tasks now complete: **01–05, 07, 09, 12, 13, 14, 16, 18,
18c**, plus 10 code-complete.

| | |
|---|---|
| **18c** (#9) | ESLint guard on the audio-signing invariant was bypassable by a relative path. Now a basename regex covering aliased, relative *and* dynamic `import()` forms |
| **12** (#10) | Toasts across the mutation surface. `add-to-collection-dialog` had **no try/catch at all** — a failed request left the optimistic count permanently wrong |
| **14** (#11) | Error + not-found boundaries. `notFound()` was already being called by two pages with nothing to render it |
| **10** (#12) | Keepalive cron + a **tested** backup/restore path |
| **13** (#16) | Download button, streaming through an authorized route |
| **16** (#18) | Duration accuracy: long sessions went from **82% → 98%** of requested |
| **18** (#13) | Model swapped to `claude-sonnet-5` |
| **14** (#14) | **Production hotfix** — see below |
| **15, 17, 20** | Docs: verified production state, `.worktreeinclude`, three new tracked ideas |

---

## Production: live, and what it cost to get there

The deploy surfaced **three** failures in sequence, each hiding the next. Worth reading —
two were defects that local development structurally could not catch.

**1. Migrations were never applied.** Connecting the Supabase GitHub integration applies
nothing by itself; it deploys **on push to `main`**, so the first merge after connecting is
what ran them. Auth worked throughout because the `auth` schema is Supabase-managed, which
made it look like the app was fine until the first query.

**2. No `GRANT` statements existed in any migration.** Every table enabled RLS with a full
set of policies — but **grants are checked before RLS**, so the policies were never
consulted. Production returned `permission denied for table meditations` on every
authenticated page. It worked locally only because the local database grants `ALL` to
`anon` and `authenticated` through default privileges, which the hosted project does not.

> **Local cannot verify grants.** The app works locally whatever the grants say. The
> privilege list in `20261001000000_grant_table_privileges.sql` was derived by walking
> every `.from(...)` call site and resolving its client, not by testing. If you add a table
> or a new operation, you must do the same — there is no test that will catch this.

**3. `SUPABASE_SERVICE_ROLE_KEY` was missing in Vercel.** `hydrateAudioUrls` constructs the
service-role client *before* checking whether there are any paths to sign, so the dashboard
threw even with zero meditations. That eager construction is correct — deferring it would
have hidden the misconfiguration until the first meditation with audio.

### Verified in production

| Check | Result |
|---|---|
| `/api/generate` with no session | **401** — task 01's fix holding, on a public repo |
| `/api/cron/keepalive` no/wrong bearer | **401** (not 503, which proves `CRON_SECRET` is set) |
| `meditation-audio` bucket, anonymous | `NoSuchBucket` — private |
| `anon` against every table | `permission denied` — no anonymous read anywhere |
| Bogus path | Branded 404 |

---

## Two places the task files were wrong

Both were caught by measuring rather than reasoning. Expect more of this.

**Task 16's premise was wrong.** It predicted long meditations become "a wall of
narration." They don't — speech share *falls* as duration rises (23% at 5 min → 6% at 60).
The real defect was **length**: 30- and 60-minute requests came out at ~80% of target with
huge variance (ask for 60, get 41–51). Fixed by giving the model explicit arithmetic and a
silence budget. **Its 30–50% / 15–25% speech-density criteria were deliberately not
implemented** — real output is 6–11% speech, and enforcing the bands would add 6–12 minutes
of narration to an hour-long session, raising ElevenLabs cost for a worse product. The file
records this.

**My own first analysis of task 16 was also wrong.** I measured the *seeded* scripts and
concluded everything undershot by 30–49%. Those were hand-written, not model output. The
real baseline was much better at short durations. I flagged the caveat at the time; it
mattered.

---

## Current state

**Live:** `https://www.zeneratestudio.com` (apex 308s to `www` — that's the canonical origin
and the one Supabase allowlists). Supabase ref `xnvqjqobegcpkigkmoct`, Free plan.

**Key files added this cycle**

| File | Why it matters |
|---|---|
| `supabase/migrations/20261001000000_grant_table_privileges.sql` | The grants fix. Opens with a gate that **raises if RLS is off** on any of the six tables — these grants are only safe behind RLS. Verified to fire |
| `src/app/api/cron/keepalive/route.ts` | **Fails closed**: unset `CRON_SECRET` → 503, never an open endpoint. `force-dynamic`, or a cached response would touch no database |
| `src/app/api/audio/[id]/download/route.ts` | Performs **no authorization of its own** and must not grow one — it calls `getMeditation`, which is RLS-bound. Never build a storage path from the `id` param |
| `src/lib/meditation/duration.ts` | Estimator. Only speech is approximate; pauses and silences are exact |
| `scripts/measure-script-duration.ts` | Before/after harness. **Calls the model directly, bypassing `/api/generate`, so a run cannot burn a user's quota** |
| `scripts/verify-backup.sh` | Restores a dump into a throwaway local DB. Refuses hosted URLs |
| `docs/runbooks/backup-restore.md` | The whole backup story |
| `.worktreeinclude` | Orca copies `.env.local` + `.vercel` into new worktrees. **Copies, doesn't symlink** — rotating a key leaves every worktree stale |

---

## What's left

### Blocked on accounts — human only

- **06 ElevenLabs Starter.** Blocks all audio, task 17, and the snapshot id. The free tier
  grants **no commercial rights**; this is a licensing blocker, not a quality preference
- **08 Transactional email.** Resend + DNS. Do it in the same sitting as the
  `privacy@zeneratestudio.com` mailbox (Vercel hosts DNS, **not** mailboxes — use a
  forwarder). Confirmed in production: the default Supabase confirmation email never names
  Zenerate or the domain and carries a "powered by Supabase" footer
- **11 Password reset.** Needs 08. A user who forgets their password currently has no path

### Small, human verification

- **10** — confirm the cron fired (Vercel logs, filter `/api/cron/keepalive`, look for a
  daily 200), and run one production dump
- **09** — missing env vars: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
  `AUDIO_SANDBOX_SNAPSHOT_ID`. `NEXT_PUBLIC_SITE_URL` unverified (nothing reads it until 08)
- **13** — the iOS Safari download check, which needs a real device

### Agent work, unblocked now

- **18b — public content signed out.** **Two parts, and the second is easy to miss:** the
  `(app)/layout.tsx` redirect *and* `grant select on public.meditations to anon`. The RLS
  policy already permits `is_public = true` rows, but grants precede RLS, so unwalling
  `/discover` alone still returns `permission denied`
- **15 — legal pages.** Only the contact address is blocked; everything else is draftable
- **17 — sound effects.** The old handoff called this blocked on a Vercel project. One now
  exists and `.vercel` is linked, so `Sandbox.create()` may just work. **Worth checking** —
  it produces the missing `AUDIO_SANDBOX_SNAPSHOT_ID`
- **Phase 3 (19–26)** — untouched. Start with 19 (repo skills), which keeps 20–23 consistent

### Issues worth re-reading

- **#5** — a failed Anthropic call still burns the user's quota slot. Filed as post-ship
  *before* the app was live. Now its likeliest failure mode is exactly an API call failing
- **#19** — `claude-sonnet-5-5` shipped 2026-09-28, after the task 18 swap. Cheap to
  evaluate because task 16 built the harness

---

## Gotchas that cost real time

- **`ANTHROPIC_API_KEY` in `.env.local` is valid.** Script generation runs fully locally.
  Prefer a *separate* key for production
- **`CLAUDE.md`'s "Where Things Live" table is stale** — missing every path added this
  cycle. A small PR, deliberately deferred to avoid conflicting with open branches
- **`parser.ts` silently drops** any line starting with `*[` that doesn't match a marker
  regex — neither parsed nor kept as speech. `*[PAUSE: 3 seconds]* Welcome back.` on one
  line loses the pause **and** the words. 17 tests document the shapes that vanish
- **A route directory starting with `_` is a Next.js private folder** and never becomes a
  route. A throwaway `__boom/page.tsx` silently 404s instead of throwing
- **sonner renders its container lazily** — `[data-sonner-toaster]` is absent until a toast
  is live, so an idle page legitimately looks like the Toaster isn't mounted
- **Local seed data has no audio.** Every meditation is `script_ready` with a null
  `audio_path`, so the player never renders locally without fabricating one
- **The speech rate in `duration.ts` is derived, not measured** (150 wpm × `speed: 0.85`).
  Calibrate it against one real narration once audio works; everything else is exact

## Corrections to the previous handoff

`phase-1-accounts-and-deploy.md` says to pick up "`tasks/ship/18c` (issue #3)" **twice**.
18c is issue **#4**; #3 is the post-ship `audio_url` column drop. Both READMEs have been
fixed; the old handoff was left as a point-in-time record.

---

## The exact next step

**If you want the biggest unblock:** check whether **task 17** can run now. `.vercel` is
linked and `VERCEL_TOKEN` is in `.env.local`, so `npx tsx scripts/create-sandbox-snapshot.ts`
may succeed — and it produces the `AUDIO_SANDBOX_SNAPSHOT_ID` that audio generation needs.

**If you want a clean ship-blocker:** take **18b**. It's small, fully specified above, and
the `anon` grant half is already worked out.

**Do not** start 06, 08 or 11 — they need accounts only the human can create.

**Before testing generation in production:** set `ANTHROPIC_API_KEY` in Vercel first.
Per issue #5, a failed call burns a quota slot, so testing without the key spends the
user's allowance on nothing.
