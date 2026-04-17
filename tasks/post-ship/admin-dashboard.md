# Admin Dashboard

**Status:** Not started
**Priority:** Post-ship

## Why it matters
Once real users exist, the operator (you) needs visibility: who signed up, how much is each user generating, what's the total monthly ElevenLabs spend, any failed workflows needing intervention, any reported content.

## Scope sketch
- `/admin` route, gated to a hardcoded list of admin user IDs or an `is_admin` column
- **Users view** — list of users, signup date, tier, generation count this month, last active
- **Usage view** — aggregate: total generations today/week/month, total TTS characters, estimated spend, per-model breakdown
- **Meditations view** — list of recent meditations, status breakdown, failed-pipeline table with retry action
- **Reports view** — ties into `public-content-moderation.md`, list of reported public meditations for review
- **Manual quota override** — bump a user's cap without changing their tier (support ticket handling)

## Key decisions to make
- Build as part of the main app with a simple gate, or separate internal-only app? (Default: part of main app, `/admin` with RLS-bypass service-role queries.)
- Read-only vs write actions? Write actions (refund quota, revoke access, delete content) mean more auth rigor.

## Implementation notes
- Admin pages should use `src/lib/supabase/service-role.ts` to bypass RLS for full visibility.
- Gate access in a layout (`src/app/(admin)/layout.tsx`) — redirect non-admins, don't rely on client-side checks.
- Keep admin actions audit-logged to a table (`admin_audit_log`) — critical for post-hoc debugging and trust.
