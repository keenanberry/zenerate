# ElevenLabs Production Account

**Status:** Done (operator confirmed the Starter subscription 2026-10-09; voices shipped in PR #25)
**Priority:** Ship-blocker
**Blocks:** 03 (quota is derived from the purchased plan)

## Why this blocks ship

Two problems, one fix.

**Licensing.** The free tier grants **no commercial use rights** and requires
"elevenlabs.io" attribution wherever output is shared. A publicly deployed app is outside
those terms whether or not we charge for it. Commercial rights start at Starter, $6/mo.
Rights are perpetual for anything generated while subscribed, even after cancelling.

**Quality.** The current picker exposes six premade voices, which are optimised for
narration and don't have the slow, low-energy delivery a meditation wants. The Voice
Library — where usable meditation voices actually live — is also gated behind Starter.

Same $6 fixes both.

## Plan sizing

Measured against the seeded scripts: **~930 speech characters per meditation** (most of a
meditation's runtime is silence, not speech, so this is far cheaper than duration
suggests).

| Plan | Price | Credits | ≈ Meditations/mo |
|---|---|---|---|
| Free | $0 | 10k | ~10 — **no commercial rights** |
| **Starter** | **$6** | **30k** | **~32** |
| Creator | $22 | 121k | ~120 |
| Pro | $99 | 600k | ~600 |

**Starter** is the decision. Covers the primary user plus a handful of early users at
3/month each.

## Acceptance criteria

- [x] ElevenLabs Starter subscription active on an account we control long-term (not a personal trial address that will lapse)
- [x] `ELEVENLABS_API_KEY` rotated to the paid account's key, updated locally and in Vercel
- [x] At least 4–6 meditation-appropriate voices selected from the Voice Library and added to the account, auditioned against a real generated script rather than the library preview
- [x] **`src/app/api/voices/route.ts:39` filter fixed** — it currently requires `v.category === "premade"` against a hardcoded set of six names, so Voice Library voices will not appear no matter what is added to the account
- [x] `VOICE_DESCRIPTIONS` updated for the new roster, written for meditation context ("slow, breathy, low register") not generic voice-acting terms
- [ ] **`voiceSettings` wired through** — `src/lib/audio/generate-audio.ts:37-41` accepts stability/similarityBoost/style/speed, but the config assembled in `src/lib/audio/workflow.ts:74-80` omits it, so every voice silently runs on the hardcoded fallback
- [ ] Per-voice tuning stored alongside each voice rather than one global default — different voices want different settings
- [x] Sandbox snapshot rebuilt after any `generate-audio.ts` change, `AUDIO_SANDBOX_SNAPSHOT_ID` updated locally and in Vercel
- [x] End-to-end: generate a full meditation on a new voice and listen to it start to finish

## Outcome

- Starter is active on the operator's account (operator, 2026-10-09). The key in Vercel is
  the paid account's.
- The picker offers the operator's "Zenerate" collection (nine voices, Brittney default),
  enforced server-side by an allowlist rather than a category filter: PR #25.
- `voiceSettings` and per-voice tuning were **not** done; every voice runs on the
  fallback in `generate-audio.ts` (speed 0.85, stability 0.5). Revisit only if a voice
  sounds off in a real generation; it would need a snapshot rebuild.
- End-to-end on Brittney: the launch sound check, 2026-10-09, all six sounds, local.
  The production listen is on the Phase 3 operator checklist.

## Implementation notes

- The category filter is the trap. Adding a Voice Library voice to your account returns it with a non-`premade` category, so the upgrade is completely invisible in the UI until that line changes. Prefer an explicit allowlist of `voiceId`s over filtering by category — it's what the code is really trying to express, and it won't silently drop voices again.
- `speed: 0.85` in the current fallback is already a sensible meditation default. `stability: 0.5` is on the low side — higher stability (0.6–0.75) gives a more even, less emotive delivery, which is what you want here. Tune per voice.
- `modelId: "eleven_multilingual_v2"` is the quality model and the right choice; latency doesn't matter because generation is async in a sandbox.
- **Snapshot gotcha:** `generate-audio.ts` is baked into the sandbox snapshot. Editing it without `npx tsx scripts/create-sandbox-snapshot.ts` has zero runtime effect and looks like a code bug. See task 19's `audio-pipeline` skill.

## Open questions

- Professional Voice Cloning (Creator tier, $22) would allow a custom house voice. Attractive but not a launch requirement — revisit once there's evidence anyone but the primary user cares.
