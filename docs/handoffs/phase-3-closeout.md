# Handoff — Phase 3 Closeout: Brand & PWA

**Written:** 2026-10-09
**Branch:** `main` at `8d071f7` (PRs #27–#35 merged).
**Supersedes:** `phase-2-closeout.md`

---

## What we set out to do

Finish Phase 3 of `tasks/ship/` (19–26) in one sitting, with Orca orchestration: one
coordinator, eight opus workers in their own worktrees, one PR per task against `main`,
waves gated on merges, the coordinator reviewing and merging. All eight tasks are done.
What remains is on a phone, in Vercel, or in a share sheet.

## What's done

| PR | Task | What |
|---|---|---|
| #27 | **19** | `zenerate-design` and `audio-pipeline` skills, each tested on a fresh agent before and after; `DESIGN.md`, `PRODUCT.md` and the Impeccable sidecar; README rewritten |
| #28 | **20** | Lora loaded; `--font-sans`, `--font-serif`, `--font-mono` wired through their `next/font` variables; script in Lora at 1.9 line-height in a 65ch column; headings in Lora, chrome in Geist |
| #29 | **25** | Media Session on wavesurfer's own `<audio>` (it lives in the waveform's shadow root): title, artwork, play/pause, 15 s skips, seekbar. 26 tests. Also fixed the volume slider rebuilding the player |
| #30 | **21** | Nocturne pass: gradient token pair and halo, no in-flow shadows, gradient play button and played waveform, script follows playback, markers in small-caps sans, rhythm table in `DESIGN.md` |
| #31 | **22** | Landing page on the locked pitch, a script streaming into the real viewer, free tier read from the quota config, one shared `Nav`. Lighthouse 93/100/100/100 mobile, 100s desktop |
| #32 | **23** | Bodhi leaf mark with its veins drawn as a tree (`src/assets/brand/mark.svg`), `BrandMark` component, every raster rebuilt deterministically by `scripts/build-icons.ts`, OG image |
| #33 | **24** | `manifest.ts`, Apple web-app metadata, per-scheme `theme-color`; grounds pinned to `DESIGN.md` by a test |
| #34 | 23 follow-up | Mark placed beside the wordmark in the nav and above it on the login card |
| #35 | **26** | `metadataBase`, Open Graph and Twitter cards with per-page overrides, `robots.ts`, hourly `sitemap.ts`; `/meditation/[id]` stays dynamic and cookie-bound |

Decisions and evidence are in each task file's **Outcome** section and each PR body. The
PR bodies carry the verification order used and a **For the operator** list; those lists
are consolidated below.

---

## Operator checklist — verify, don't assume

Nothing below was run by an agent. Each needs a phone, a share sheet, Vercel, or a visible
screen.

**Vercel**
1. Set `NEXT_PUBLIC_SITE_URL=https://www.zeneratestudio.com` in Production and redeploy.
   `NEXT_PUBLIC_` values are inlined at build time. The fallback already points at
   production, so nothing is broken meanwhile (#35).
2. Still open from Phase 2: confirm `AUDIO_SANDBOX_SNAPSHOT_ID` is
   `snap_MXu6Sl0RX5di37AmE6j8vM7Nhz8y` and production was redeployed after setting it;
   `curl` a public meditation with no cookies to prove the `anon` grant; run one real
   production audio generation and listen.

**Mac, Chrome, screen unlocked** (#29)
3. Play a completed meditation with a long silence. Control Center → Now Playing shows the
   title with "Zenerate" beneath; play/pause and the 15 s skips work from there; audio
   continues with the tab backgrounded and Chrome hidden; narration resumes after the
   silence without a tap.

**iPhone, Safari** (#29, #33, #34, #30, #31)
4. Lock the screen during playback: audio continues, the lock screen shows the title and
   the mark, play/pause and the skips work, no previous/next buttons. Switch apps: audio
   continues.
5. Share → Add to Home Screen: the lotus on a Midnight tile, name "Zenerate", opens without
   Safari chrome, status bar legible. **The first launch shows you signed out.** iOS gives
   home-screen apps their own storage jar; sign in once inside the app and it persists.
   Then repeat the lock-screen checks inside the installed app, and open the landing page
   as its start page.
6. In both themes: the player's glow (dark) and tint (light), the follow-along
   brightening and dimming roughly in time with narration, the header mark beside the
   wordmark at 1x and 2x. With Reduce Motion on: script lines change instantly, the
   landing demo shows the whole script and reads "Ready", the processing halo does not
   animate.

**Share cards** (#32, #35)
7. Paste `https://www.zeneratestudio.com/` and one public meditation into at least two of
   iMessage, Slack, X, Discord: large card, the lotus, the pitch or the meditation's title and
   description. Run the Facebook sharing debugger on `/`, `/discover` and one meditation.
8. Open `/robots.txt` and `/sitemap.xml` on production; the sitemap lists the live public
   meditations (it refreshes hourly).

**Odds and ends**
9. Favicon in Chrome's *light* tab theme; the inactive light tab is the weakest pairing.
10. Android: the maskable icon's circle crop keeps the whole lotus.
11. One product decision from #35: the owner of a private meditation sees its title in
    their own tab (with `noindex`); the brief had said a generic title. Keep or change,
    one line in `meditationMetadata`.

---

## What's left

### Phase 2, waiting on the operator's Resend setup
- **08 Transactional email**, then **11 Password reset**. Set up the
  `privacy@zeneratestudio.com` forwarder in the same sitting; both legal pages publish it.

### Post-ship
`tasks/post-ship/README.md`, plus two ideas from this session:
- Seed one `completed` meditation locally with a tiny generated audio file. Three workers
  had to build throwaway harness routes because no completed meditation exists in the
  seed, and the player, follow-along and sitemap could not be checked on real data.
- Dynamic per-meditation OG images (task 23 deliberately shipped a static one).

---

## Gotchas that cost real time

- **`next/font` family names are plain under Turbopack, hashed under webpack.** The Phase 3
  setup claimed `--font-sans: Geist` matched nothing because names are hashed; task 20
  measured it and found Geist was already rendering. Only Lora and Fira Code were unloaded.
  Wiring tokens through the `--font-*` variables is still right (metric-matched fallback,
  bundler-independent). `DESIGN.md`'s Loaded Face Rule and the skill are correct now.
- **Parallel workers both editing `tasks/ship/README.md` conflict every time** (adjacent
  rows). Resolve mechanically: main's table with the PR's own row. Happened on #32 and #34.
- **npm 11 rewrites the whole lockfile** when a worker worktree runs `npm install`
  (~23k lines). Never commit that churn; #32 spliced in only the new `@resvg` entries.
- **A locked screen makes every Chrome page `hidden`,** and Chrome will not load media for a
  page that has never been visible. Task 25's Mac checks could not run for that reason.
  Schedule anything that needs playback or screenshots for when the screen is up.
- **Workers on localhost share one Supabase auth cookie.** A worker signing out revokes the
  others' sessions; the workers avoided it, and the next coordinator should say so in specs.
- **The rose is `--accent` in light but `--accent-foreground` in dark.** The gradient has
  its own token pair now (`--gradient-start`/`--gradient-end`); never reach through
  `--accent` for it.
- **`worker-release` sometimes reports `retained`** with the agent terminal left open (tasks
  21 and 25). `worker-list --terminal-state reclaimable` was empty each time, so nothing was
  owed; it is a tab left in the sidebar, not a lifecycle problem.

## Orchestration record

Run `run_82bcf0f2f22a`, eight Tasks, every Dispatch settled `succeeded`, every terminal
released. The eight worker worktrees are still in Orca under
`~/orca/workspaces/zenerate/phase3-*`, all merged, each holding only lockfile churn.
Remove them with `orca worktree rm --worktree path:<path> --force --json` once nothing in
them is wanted.

## The exact next step

Work the operator checklist above, top to bottom; items 1 and 5 unblock the most. Then
either task 08 (Resend in hand) or the post-ship list. Read the task 19 Outcome before
touching the skills: it records how they were tested, and the one claim it had wrong.
