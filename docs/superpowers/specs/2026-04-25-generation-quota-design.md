# Generation Quota — Design

**Status:** Approved (design phase) — 2026-04-25
**Tracks:** `tasks/ship/03-generation-quota.md`
**Author:** Keenan + Claude (brainstorming session)

## Goal

Cap free-tier users at **3 audio generations per calendar month** to bound ElevenLabs TTS spend. Add a global monthly circuit breaker so a bug or viral moment can't exhaust the budget overnight. Surface remaining quota in the UI so users aren't surprised.

Script generation (Anthropic) remains unmetered.

## Policies

| Policy | Decision |
|---|---|
| Per-user cap | 3 successful or in-flight generations per calendar month (UTC) |
| Failed-run refund | 1 free retry per failed event; failed and free-retry rows do not count toward the cap |
| Global circuit breaker | Env-var-controlled monthly ceiling on total generations across all users |
| Reset boundary | First day of next calendar month (UTC) |
| Atomicity | "Check + reserve" happens in a single Postgres function under an advisory lock to prevent parallel-request bypass |

## Schema

New table `public.audio_generation_events` (append-only — no row is ever deleted; failures and retries are recorded explicitly).

```sql
create table public.audio_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  meditation_id uuid references public.meditations(id) on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending','completed','failed')),
  is_free_retry boolean not null default false,
  retry_of uuid references public.audio_generation_events(id),
  year_month text generated always as (to_char(created_at, 'YYYY-MM')) stored,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.audio_generation_events enable row level security;

create policy "select_own" on public.audio_generation_events
  for select using (auth.uid() = user_id);
-- No insert/update policies — writes only via service role from API routes.

create index idx_audio_gen_user_month
  on public.audio_generation_events(user_id, year_month)
  where is_free_retry = false;

create index idx_audio_gen_global_month
  on public.audio_generation_events(year_month)
  where is_free_retry = false;
```

### Quota math

Per user, current month:

```sql
select count(*)
from public.audio_generation_events
where user_id = $1
  and year_month = to_char(now(), 'YYYY-MM')
  and is_free_retry = false
  and status in ('pending', 'completed');
```

`pending` rows count so concurrent in-flight requests can't bypass the cap. `failed` rows do not count (matches the 1-free-retry policy). `is_free_retry = true` rows never count.

## Postgres function: `reserve_audio_generation`

Encapsulates the atomic check + reserve. Called from the API route via the service-role client.

**Signature:**
```sql
reserve_audio_generation(
  p_user_id uuid,
  p_meditation_id uuid,
  p_per_user_cap integer,
  p_global_cap integer,
  p_retry_of uuid default null
) returns uuid
```

**Behavior:**

1. Acquire `pg_advisory_xact_lock(hashtext(p_user_id::text))` so concurrent calls from the same user serialize.
2. **Free-retry path** (`p_retry_of is not null`):
   - Verify the parent event belongs to `p_user_id`, has `status = 'failed'`, and has no existing free-retry row pointing at it.
   - On failure of any check, raise `invalid_retry`.
   - On success, insert a row with `is_free_retry = true, retry_of = p_retry_of, status = 'pending'`. Return the new id. No quota check applies.
3. **Normal path:**
   - Count this month's rows globally where `status in ('pending', 'completed') and is_free_retry = false`. If `>= p_global_cap`, raise `global_cap_reached`.
   - Count this month's rows for this user with the same predicate. If `>= p_per_user_cap`, raise `quota_exceeded`.
   - Insert a `pending` row, return the new id.

Per-user and global counts share the same predicate so a single set of partial indexes covers both. Free-retry rows are excluded from both counts; this means a worst-case scenario where every paid run fails and gets retried for free roughly doubles the global TTS cost (still bounded — `p_global_cap × 2 × $0.30/run`).

Errors raised use distinct SQLSTATE codes (or `raise exception using errcode = ...`) so the route handler can distinguish them.

## API route changes — `POST /api/audio/generate`

Order of operations after the existing auth + meditation-ownership + status validation:

1. Read optional `retryOfEventId` from the request body.
2. Call `reserve_audio_generation` via the service-role client.
   - Maps `quota_exceeded` → `429` + `{ error: "Monthly limit reached", remaining: 0 }`.
   - Maps `global_cap_reached` → `503` + `{ error: "Audio generation is temporarily unavailable. Try again next month." }`.
   - Maps `invalid_retry` → `400` + `{ error: "This generation can't be retried for free." }`.
3. Update meditation `status` to `processing_audio` (existing behavior).
4. Pass `eventId` into the workflow as a third argument to `processAudioWorkflow`.
5. Workflow updates the event on terminal outcome:
   - Success: `update audio_generation_events set status='completed', completed_at=now() where id = $1`.
   - Failure: `update audio_generation_events set status='failed', completed_at=now() where id = $1`.

Response on success unchanged: `202` with `{ meditationId, runId, status: "processing_audio" }` plus a new `eventId` field for the client.

## Quota read — `getQuotaUsage()`

Single source of truth for "how many does this user have left," used by the dashboard and the audio-section parent.

```ts
// src/lib/audio/quota.ts

export type QuotaUsage = {
  used: number;       // non-free-retry rows this month with status in (pending, completed)
  limit: number;      // PER_USER_MONTHLY_AUDIO_LIMIT, default 3
  remaining: number;  // max(limit - used, 0)
  resetsAt: string;   // ISO of first day of next month (UTC)
};

export async function getQuotaUsage(userId: string): Promise<QuotaUsage>;
```

Module also owns:
- Env-var reads (`PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`) with `zod` (or manual) validation at module load.
- A typed wrapper around the `reserve_audio_generation` RPC for the route handler.
- `isFreeRetryAvailable(meditationId, userId): Promise<boolean>` — true when the latest event for that meditation has `status = 'failed'` and no child row references it via `retry_of`. Used by `audio-section.tsx` to decide whether to render the "Retry — free" button.

Server-action pattern (no new HTTP endpoint). Server components call `getQuotaUsage()` and pass the result down as props; client components never fetch quota directly.

## UI changes

### 1. Dashboard (`src/app/(app)/dashboard/page.tsx`)

Quota indicator near the "Create" CTA: `"2 of 3 audio generations used this month · resets May 1"`. When `remaining === 0`, the indicator turns muted-destructive and a helper line appears: *"You've used your audio generations this month. You can still generate scripts."* The Create button stays enabled (script generation is free).

### 2. Generate-audio panel (`src/components/generate-audio-panel.tsx`)

Quota state is passed in as a prop from the server-rendered parent (`audio-section.tsx`). Three states:

- **`remaining > 1`** — button enabled. Caption above: *"This will use 1 of your X remaining audio generations."*
- **`remaining === 1`** — confirm step on click. Button swaps to a `"Confirm — use last generation"` / `"Cancel"` pair (no modal).
- **`remaining === 0`** — button disabled. Replacement copy: *"You've used all 3 audio generations this month. Resets May 1."*

API errors surface inline within the panel (no toast — toasts are deferred to ship task #07): `429` → "Monthly limit reached." `503` → "Audio generation is temporarily paused. Please try again next month."

### 3. Failed-meditation retry (`src/components/audio-section.tsx`)

When `meditation.status === 'failed'` and `isFreeRetryAvailable()` returns true, show a `"Retry — free"` button alongside the existing failure copy. It calls `POST /api/audio/generate` with `retryOfEventId` set to the failed event's id. The latest event id is also passed down from the server component.

### 4. Future placement (out of scope, noted)

When a user-profile / account page is added, surface the same quota indicator there using `getQuotaUsage()`. One-line addition; not built now.

## Env vars

| Name | Default | Purpose |
|---|---|---|
| `PER_USER_MONTHLY_AUDIO_LIMIT` | `3` | Per-user monthly cap. Bumpable without deploy. |
| `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` | `500` | Global circuit breaker. At ~$0.30/run, ~$150/month worst case. |

Both added to `.env.example` with comments and listed as required production env vars in `tasks/ship/02-vercel-deploy.md`.

## Migration

Single new file: `supabase/migrations/20260425000000_audio_generation_events.sql` containing table, indexes, RLS, and the `reserve_audio_generation` function.

No backfill required. Existing meditations have no associated events; counting starts fresh at deploy. Existing users effectively get the rest of the current calendar month "free." Acceptable for ship.

## Tests

**Unit (`src/lib/audio/quota.test.ts`):**
- Fresh user → `{ used: 0, limit: 3, remaining: 3 }`.
- One pending + one completed → `{ used: 2, remaining: 1 }`.
- Three completed → `{ remaining: 0 }`.
- Three completed plus one failed → `{ remaining: 0 }`, free retry available for the failed one.
- Three completed plus failed plus its free-retry → `{ remaining: 0 }`, no further retry available.

**Integration (`src/app/api/audio/generate/route.test.ts`):**
- Four sequential requests as one user → 3× `202`, 4th `429`.
- Global cap = `2` env override; two requests across two users succeed, third returns `503`.
- Failed event + retry request → `202`, no quota decrement.
- Retry request against a non-failed event → `400`.

**Race-condition test:** parallel-promise three requests as a user with `remaining = 2` → assert exactly two `202` responses and one `429`. Validates the advisory-lock approach.

## Out of scope (deferred)

- Per-user tier overrides (paid tier) — handled in `tasks/post-ship/paid-tier.md`.
- Admin UI for adjusting caps.
- Stripe integration / billing.
- Per-user profile page.
- Toast notifications for quota errors — covered by ship task #07.

## Acceptance criteria mapping

Cross-reference against `tasks/ship/03-generation-quota.md`:

- Schema tracking monthly count per user → `audio_generation_events` table + indexes.
- `/api/audio/generate` increments atomically on workflow trigger → `reserve_audio_generation` RPC inside the route handler.
- 429 + clear error when at cap → mapped from `quota_exceeded`.
- Panel surfaces remaining quota and disables when exhausted → three-state UI in `generate-audio-panel.tsx`.
- Refund policy on failure → 1 free retry per failed event, exposed via "Retry — free" button.
- Quota visible on dashboard → indicator near Create CTA.
- Global circuit breaker → `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` env var enforced in the same RPC.
