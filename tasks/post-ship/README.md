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
| [#3](https://github.com/keenanberry/zenerate/issues/3) | ESLint import restriction bypassed by relative paths — **pre-ship**, tracked as 18c |
| [#4](https://github.com/keenanberry/zenerate/issues/4) | Drop the retained `meditations.audio_url` column |
| [#5](https://github.com/keenanberry/zenerate/issues/5) | Script quota slot burned when the Anthropic call fails |
| [#6](https://github.com/keenanberry/zenerate/issues/6) | Extract `readPositiveInt` into a shared module |
| [#7](https://github.com/keenanberry/zenerate/issues/7) | Mid-file import in `src/lib/audio/quota.ts` |
