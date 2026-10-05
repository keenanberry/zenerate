# Post-Ship Tasks

Work that's out of scope for initial ship but tracked for the next cycle. No ordering — prioritize based on user feedback and usage data once the app is live.

| Task | Summary |
|---|---|
| [User profiles](./user-profiles.md) | Public author surface for `/discover`; private settings/quota home |
| [Paid tier](./paid-tier.md) | Stripe integration, tiered quotas, custom voice upload |
| [Google / Apple auth](./google-apple-auth.md) | OAuth providers via Supabase |
| [Admin dashboard](./admin-dashboard.md) | User + usage + cost visibility for the operator |
| [Form-based script editor](./form-based-script-editor.md) | Structured editor (add/remove sections, inline sound picker) |
| [Public content moderation](./public-content-moderation.md) | Report, review, flag for `/discover` |
| [Analytics](./analytics.md) | Usage + conversion funnel tracking |
| [Error tracking](./error-tracking.md) | Sentry or similar for production visibility |
| [AI gateway](./ai-gateway.md) | Route model calls through Vercel AI Gateway for token/cost/latency visibility |
| [Agent user memory](./agent-user-memory.md) | Remember user preferences across generations |
| [Conversational script refinement](./conversational-script-refinement.md) | Chat to iterate on a script instead of one-shot generation |

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
| [#5](https://github.com/keenanberry/zenerate/issues/5) | Script quota slot burned when the Anthropic call fails. **Worth re-reading now the app is live** — its likeliest failure mode is an API call failing, and every one permanently consumes a user's quota |
| [#6](https://github.com/keenanberry/zenerate/issues/6) | Extract `readPositiveInt` into a shared module |
| [#7](https://github.com/keenanberry/zenerate/issues/7) | Mid-file import in `src/lib/audio/quota.ts` |
| [#19](https://github.com/keenanberry/zenerate/issues/19) | Evaluate `claude-sonnet-5-5` (released 2026-09-28, after the task 18 swap). Also folds in task 18's never-run 3×3 comparison |

> The #3/#4 rows were swapped in an earlier revision of this table — #4 is the ESLint rule,
> #3 is the column drop. `tasks/ship/README.md` had the same error and was corrected in PR #9.
