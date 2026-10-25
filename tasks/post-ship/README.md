# Post-Ship Tasks

Work that's out of scope for initial ship but tracked for the next cycle. No ordering — prioritize based on user feedback and usage data once the app is live.

## Next up: scoped for a future session (2026-10-22)

The operator's candidates for after launch, each scoped with decisions to make. Nothing
has started. **Pick the paid-tier decision up before opening signups**, because it sets the
free tier.

| Task | The question it answers |
|---|---|
| [Paid tier](./paid-tier.md) | Charge about $5/month? Includes a per-meditation cost model (about $0.35–0.50) and the free tier's real Anthropic exposure |
| [User profiles](./user-profiles.md) | Let people who publish show who they are: name, a short bio, their public meditations; plus an `/account` page |
| [Google / Apple sign-in](./google-apple-auth.md) | Yes, Supabase supports both. **Google moved to ship 57** (2026-10-24) with an emailed code; Apple ($99/year) stays here |
| [Remember preferences](./agent-user-memory.md) | "Brittney again, or change it up?" The audio card preselects the last voice and bed, and the agent gets a short summary of recent choices. Derived from existing `settings`, so no new table for the first slice |

## Everything else

| Task | Summary |
|---|---|
| [User profiles](./user-profiles.md) | Public author surface for `/discover`; private settings/quota home |
| [Paid tier](./paid-tier.md) | Stripe integration, tiered quotas, custom voice upload |
| [Google / Apple auth](./google-apple-auth.md) | OAuth providers via Supabase. **Google moved to ship 57** (2026-10-24); Apple stays here |
| [Admin dashboard](./admin-dashboard.md) | User + usage + cost visibility for the operator |
| [Public content moderation](./public-content-moderation.md) | Report, review, flag for `/discover`. **A minimal Report link moved to ship 53** (2026-10-23); the queue stays here |
| [Analytics](./analytics.md) | Usage + conversion funnel tracking |
| [Backup retention](./backup-retention.md) | **Moved to ship 52** (2026-10-23). Prune dumps past 30 days, as `/privacy` promises; re-apply deletions after a restore |
| [Account deletion](./account-deletion.md) | Self-serve delete, including the audio files storage does not cascade |
| [Chat deletion](./chat-deletion.md) | Let the owner delete a chat; today chats go only with the account |
| [Error tracking](./error-tracking.md) | **Moved to ship 51** (2026-10-23). Sentry or similar for production visibility |
| [AI gateway](./ai-gateway.md) | Route model calls through Vercel AI Gateway for token/cost/latency visibility |
| [Agent user memory](./agent-user-memory.md) | Remember user preferences across generations. Unblocked by the chat agent (ship 29) |
| [Generated cover art](./generated-cover-art.md) | Per-meditation artwork replacing the designed covers from ship task 35 |
| [Stale audio run recovery](./stale-audio-run-recovery.md) | Unstick `processing_audio` rows whose workflow run died before `markFailed`; ask the run's status, refund the slot, offer the free retry |

## Promoted or dropped (2026-10-20)

The agentic studio spec (`docs/superpowers/specs/2026-10-20-agentic-studio-design.md`)
moved three items out of this folder:

- **Conversational script refinement** is now the studio itself, ship tasks 27–32.
- **Tags and filters** is now ship tasks 28, 29 (vocabulary), 33 and 36.
- **Form-based script editor** is dropped. Editing happens by conversation, and the
  only hand-edit left is title, description and tags (ship 33).

See `docs/ui-roadmap.md` for additional UX-focused improvements, and
`docs/superpowers/specs/2026-09-11-go-live-design.md` for what was deliberately
deferred here at launch — notably offline playback and web push, which both need a
service worker and are unlocked by the PWA work in `tasks/ship/24`.

## Tracked as GitHub issues

Smaller findings from the Phase 0 security work live as issues rather than task files —
each is a single contained change, not a project:

| Issue | Summary |
|---|---|
| [#2](https://github.com/keenanberry/zenerate/issues/2) | Advisory lock collision between audio and script quota reservations |
| [#3](https://github.com/keenanberry/zenerate/issues/3) | Drop the retained `meditations.audio_url` column |
| [#4](https://github.com/keenanberry/zenerate/issues/4) | ~~ESLint import restriction bypassed by relative paths~~ — **closed** by PR #9 (tracked as 18c) |
| [#5](https://github.com/keenanberry/zenerate/issues/5) | Script quota slot burned when the Anthropic call fails. **Moot once ship task 29 lands**: it retires the monthly script quota, so close #5 with that PR |
| [#6](https://github.com/keenanberry/zenerate/issues/6) | Extract `readPositiveInt` into a shared module |
| [#7](https://github.com/keenanberry/zenerate/issues/7) | Mid-file import in `src/lib/audio/quota.ts` |
| [#19](https://github.com/keenanberry/zenerate/issues/19) | Evaluate `claude-sonnet-5-5` (released 2026-09-28, after the task 18 swap). Also folds in task 18's never-run 3×3 comparison. Now measured on real chats as part of ship task 29 |

> The #3/#4 rows were swapped in an earlier revision of this table — #4 is the ESLint rule,
> #3 is the column drop. `tasks/ship/README.md` had the same error and was corrected in PR #9.
