# Generation Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap free-tier audio generation at 3 per user per calendar month, with a global env-var circuit breaker, 1 free retry on pipeline failure, and quota visibility in the UI.

**Architecture:** New `audio_generation_events` append-only table tracks every generation attempt. A Postgres `reserve_audio_generation` function performs the atomic check-and-reserve under an advisory lock. A new `src/lib/audio/quota.ts` module owns env-var validation, quota reads, and the RPC wrapper. The route handler `/api/audio/generate` calls reserve before triggering the workflow; the workflow updates the event row to `completed` or `failed` on terminal outcome. UI renders quota state from `getQuotaUsage()` on the dashboard and generate panel; failed meditations get a "Retry — free" button that calls the route with `retryOfEventId` set.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Vercel Workflow, Vitest (newly added), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-25-generation-quota-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `vitest.config.ts` | Create | Vitest config with path alias |
| `src/test/setup.ts` | Create | Test env loader |
| `package.json` | Modify | Add Vitest deps + `test` script |
| `supabase/migrations/20260425000000_audio_generation_events.sql` | Create | Table, indexes, RLS, RPC function |
| `src/lib/audio/quota.ts` | Create | Env validation, `getQuotaUsage`, `isFreeRetryAvailable`, `reserveAudioGeneration` |
| `src/lib/audio/quota.test.ts` | Create | Unit tests for the quota module |
| `src/lib/supabase/service-role.ts` | Create | Service-role client factory (centralizes the pattern that's currently inline in `workflow.ts`) |
| `src/app/api/audio/generate/route.ts` | Modify | Call reserve, accept `retryOfEventId`, map errors, pass eventId to workflow |
| `src/lib/audio/workflow.ts` | Modify | Accept `eventId`, update event row on success/failure |
| `src/components/quota-indicator.tsx` | Create | Server component showing "X of Y used this month" |
| `src/app/(app)/dashboard/page.tsx` | Modify | Render `<QuotaIndicator />` near Create CTA |
| `src/components/generate-audio-panel.tsx` | Modify | Three-state UI (enabled / confirm-last / disabled) using quota prop |
| `src/components/audio-section.tsx` | Modify | Accept quota + retry props, replace "Try Again" with "Retry — free" |
| `src/app/(app)/meditation/[id]/page.tsx` | Modify | Fetch quota + free-retry event id, pass to `<AudioSection />` |
| `src/lib/meditation/actions.ts` | Modify | Remove `resetMeditationStatus` (dead code) |
| `.env.example` | Modify | Add `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH` |
| `tasks/ship/02-vercel-deploy.md` | Modify | List the new env vars in the deploy checklist |
| `tasks/ship/03-generation-quota.md` | Modify | Update status |
| `tasks/ship/README.md` | Modify | Update status table |
| `scripts/test-generation-quota.ts` | Create | Manual integration test against local Supabase |

---

## Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest and helpers**

Run:
```bash
npm install -D vitest @vitest/ui dotenv
```

Expected: dependencies added to `devDependencies`, no errors.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `scripts` block of `package.json`, add `test` and `test:watch`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
}
```

- [ ] **Step 5: Add a smoke test**

Create `src/test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`

Expected: 1 test passes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/test/smoke.test.ts
git commit -m "chore: add vitest test framework"
```

---

## Task 2: Migration — table, indexes, RLS

**Files:**
- Create: `supabase/migrations/20260425000000_audio_generation_events.sql` (table + indexes + RLS portion)

- [ ] **Step 1: Create the migration file with the table, indexes, and RLS**

Create `supabase/migrations/20260425000000_audio_generation_events.sql`:

```sql
-- Audio generation events: append-only ledger of every audio generation
-- attempt. Used for per-user monthly quota and global circuit breaker.

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

-- Users can read their own events (for the UI). Writes happen only via the
-- service-role client from API routes, so no insert/update/delete policies.
create policy "select_own" on public.audio_generation_events
  for select using (auth.uid() = user_id);

create index idx_audio_gen_user_month
  on public.audio_generation_events(user_id, year_month)
  where is_free_retry = false;

create index idx_audio_gen_global_month
  on public.audio_generation_events(year_month)
  where is_free_retry = false;

create index idx_audio_gen_meditation
  on public.audio_generation_events(meditation_id, created_at desc);
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db reset`

Expected: migration applies without error; table exists.

- [ ] **Step 3: Verify table and indexes exist**

Run:
```bash
supabase db query "select indexname from pg_indexes where tablename='audio_generation_events';"
```

Expected: lists `audio_generation_events_pkey`, `idx_audio_gen_user_month`, `idx_audio_gen_global_month`, `idx_audio_gen_meditation`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260425000000_audio_generation_events.sql
git commit -m "feat: add audio_generation_events table"
```

---

## Task 3: Migration — `reserve_audio_generation` RPC function

**Files:**
- Modify: `supabase/migrations/20260425000000_audio_generation_events.sql` (append the function)

- [ ] **Step 1: Append the RPC function to the migration**

Append to `supabase/migrations/20260425000000_audio_generation_events.sql`:

```sql
-- Atomic check-and-reserve. Caller is the service-role client from the
-- /api/audio/generate route handler. Returns the new event id or raises
-- one of: 'quota_exceeded', 'global_cap_reached', 'invalid_retry'.
create or replace function public.reserve_audio_generation(
  p_user_id uuid,
  p_meditation_id uuid,
  p_per_user_cap integer,
  p_global_cap integer,
  p_retry_of uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_count integer;
  v_global_count integer;
  v_parent record;
  v_existing_retry uuid;
  v_year_month text := to_char(now(), 'YYYY-MM');
begin
  -- Serialize concurrent calls per user.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if p_retry_of is not null then
    -- Free-retry path: validate parent and ensure no existing retry yet.
    select user_id, status into v_parent
      from public.audio_generation_events
      where id = p_retry_of;

    if not found or v_parent.user_id <> p_user_id or v_parent.status <> 'failed' then
      raise exception 'invalid_retry'
        using errcode = 'P0001';
    end if;

    select id into v_existing_retry
      from public.audio_generation_events
      where retry_of = p_retry_of
      limit 1;

    if v_existing_retry is not null then
      raise exception 'invalid_retry'
        using errcode = 'P0001';
    end if;

    insert into public.audio_generation_events
      (user_id, meditation_id, status, is_free_retry, retry_of)
    values
      (p_user_id, p_meditation_id, 'pending', true, p_retry_of)
    returning id into v_event_id;

    return v_event_id;
  end if;

  -- Normal path: enforce both caps using the same predicate.
  select count(*) into v_global_count
    from public.audio_generation_events
    where year_month = v_year_month
      and is_free_retry = false
      and status in ('pending', 'completed');

  if v_global_count >= p_global_cap then
    raise exception 'global_cap_reached'
      using errcode = 'P0002';
  end if;

  select count(*) into v_user_count
    from public.audio_generation_events
    where user_id = p_user_id
      and year_month = v_year_month
      and is_free_retry = false
      and status in ('pending', 'completed');

  if v_user_count >= p_per_user_cap then
    raise exception 'quota_exceeded'
      using errcode = 'P0003';
  end if;

  insert into public.audio_generation_events
    (user_id, meditation_id, status)
  values
    (p_user_id, p_meditation_id, 'pending')
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid) from public;
grant execute on function public.reserve_audio_generation(uuid, uuid, integer, integer, uuid) to service_role;
```

- [ ] **Step 2: Re-apply the migration**

Run: `supabase db reset`

Expected: applies cleanly.

- [ ] **Step 3: Smoke-test the function**

Run:
```bash
supabase db query "select reserve_audio_generation('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 3, 500, null);"
```

Expected: foreign-key violation (user_id doesn't exist). This confirms the function is callable; full behavior is verified in Task 16.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260425000000_audio_generation_events.sql
git commit -m "feat: add reserve_audio_generation RPC"
```

---

## Task 4: Quota module — env-var loader

**Files:**
- Create: `src/lib/audio/quota.ts`
- Create: `src/lib/audio/quota.test.ts`

- [ ] **Step 1: Write failing tests for env-var loading**

Create `src/lib/audio/quota.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getQuotaConfig } from "./quota";

describe("getQuotaConfig", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.PER_USER_MONTHLY_AUDIO_LIMIT;
    delete process.env.MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns defaults when env vars unset", () => {
    const cfg = getQuotaConfig();
    expect(cfg.perUserCap).toBe(3);
    expect(cfg.globalCap).toBe(500);
  });

  it("reads positive integer env vars", () => {
    process.env.PER_USER_MONTHLY_AUDIO_LIMIT = "10";
    process.env.MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH = "1000";
    const cfg = getQuotaConfig();
    expect(cfg.perUserCap).toBe(10);
    expect(cfg.globalCap).toBe(1000);
  });

  it("throws on non-numeric env vars", () => {
    process.env.PER_USER_MONTHLY_AUDIO_LIMIT = "not-a-number";
    expect(() => getQuotaConfig()).toThrow(/PER_USER_MONTHLY_AUDIO_LIMIT/);
  });
});
```

(The `vi` import is unused here but is needed by tests added in Tasks 5–7; keep it.)

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test -- quota.test`

Expected: tests fail with "Cannot find module './quota'".

- [ ] **Step 3: Implement env-var loader in `quota.ts`**

Create `src/lib/audio/quota.ts`:

```ts
export type QuotaConfig = {
  perUserCap: number;
  globalCap: number;
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return parsed;
}

export function getQuotaConfig(): QuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_AUDIO_LIMIT", 3),
    globalCap: readPositiveInt("MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH", 500),
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- quota.test`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/quota.ts src/lib/audio/quota.test.ts
git commit -m "feat: quota module env-var loader"
```

---

## Task 5: `getQuotaUsage` helper

**Files:**
- Modify: `src/lib/audio/quota.ts`
- Modify: `src/lib/audio/quota.test.ts`

- [ ] **Step 1: Add tests for `getQuotaUsage`**

Append to `src/lib/audio/quota.test.ts`:

```ts
import { getQuotaUsage } from "./quota";

function makeUsageSupabase(count: number, error: { message: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("getQuotaUsage", () => {
  it("returns used=0 / remaining=limit on empty count", async () => {
    const supabase = makeUsageSupabase(0);
    const usage = await getQuotaUsage(
      "user-1",
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(usage.used).toBe(0);
    expect(usage.remaining).toBe(3);
    expect(usage.limit).toBe(3);
    expect(usage.resetsAt).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
  });

  it("clamps remaining at zero when used exceeds limit", async () => {
    const supabase = makeUsageSupabase(5);
    const usage = await getQuotaUsage(
      "user-1",
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(usage.used).toBe(5);
    expect(usage.remaining).toBe(0);
  });

  it("throws when supabase returns an error", async () => {
    const supabase = makeUsageSupabase(0, { message: "db down" });
    await expect(
      getQuotaUsage("user-1", supabase as never, { perUserCap: 3, globalCap: 500 }),
    ).rejects.toThrow(/db down/);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test -- quota.test`

Expected: failures — `getQuotaUsage` not exported.

- [ ] **Step 3: Implement `getQuotaUsage`**

Append to `src/lib/audio/quota.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaUsage = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
};

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonthFirstUtcIso(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

export async function getQuotaUsage(
  userId: string,
  supabase: SupabaseClient,
  config: QuotaConfig = getQuotaConfig(),
): Promise<QuotaUsage> {
  const { count, error } = await supabase
    .from("audio_generation_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("year_month", currentYearMonth())
    .eq("is_free_retry", false)
    .in("status", ["pending", "completed"]);

  if (error) {
    throw new Error(`Failed to read quota usage: ${error.message}`);
  }

  const used = count ?? 0;
  return {
    used,
    limit: config.perUserCap,
    remaining: Math.max(config.perUserCap - used, 0),
    resetsAt: nextMonthFirstUtcIso(),
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- quota.test`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/quota.ts src/lib/audio/quota.test.ts
git commit -m "feat: getQuotaUsage helper"
```

---

## Task 6: `isFreeRetryAvailable` helper

**Files:**
- Modify: `src/lib/audio/quota.ts`
- Modify: `src/lib/audio/quota.test.ts`

- [ ] **Step 1: Add tests for `isFreeRetryAvailable`**

Append to `src/lib/audio/quota.test.ts`:

```ts
import { isFreeRetryAvailable } from "./quota";

function makeRetrySupabase(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let call = 0;
  return {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        const next = responses[call] ?? { data: null, error: null };
        call += 1;
        return Promise.resolve(next);
      }),
    })),
  };
}

describe("isFreeRetryAvailable", () => {
  it("returns false when no events exist", async () => {
    const supabase = makeRetrySupabase([{ data: null, error: null }]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });

  it("returns true with eventId when latest event is failed and has no retry", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "failed" }, error: null },
      { data: null, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: true, eventId: "evt-1" });
  });

  it("returns false when latest event is not failed", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "completed" }, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });

  it("returns false when failed event already has a retry", async () => {
    const supabase = makeRetrySupabase([
      { data: { id: "evt-1", status: "failed" }, error: null },
      { data: { id: "evt-2" }, error: null },
    ]);
    const result = await isFreeRetryAvailable("med-1", "user-1", supabase as never);
    expect(result).toEqual({ available: false, eventId: null });
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test -- quota.test`

Expected: failures — `isFreeRetryAvailable` not exported.

- [ ] **Step 3: Implement `isFreeRetryAvailable`**

Append to `src/lib/audio/quota.ts`:

```ts
export type FreeRetryStatus = {
  available: boolean;
  eventId: string | null;
};

export async function isFreeRetryAvailable(
  meditationId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<FreeRetryStatus> {
  const { data: latest, error: latestError } = await supabase
    .from("audio_generation_events")
    .select("id, status")
    .eq("meditation_id", meditationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to read latest event: ${latestError.message}`);
  }
  if (!latest || latest.status !== "failed") {
    return { available: false, eventId: null };
  }

  const { data: existingRetry, error: retryError } = await supabase
    .from("audio_generation_events")
    .select("id")
    .eq("retry_of", latest.id)
    .limit(1)
    .maybeSingle();

  if (retryError) {
    throw new Error(`Failed to read retry events: ${retryError.message}`);
  }
  if (existingRetry) {
    return { available: false, eventId: null };
  }
  return { available: true, eventId: latest.id };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- quota.test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/quota.ts src/lib/audio/quota.test.ts
git commit -m "feat: isFreeRetryAvailable helper"
```

---

## Task 7: `reserveAudioGeneration` wrapper

**Files:**
- Modify: `src/lib/audio/quota.ts`
- Modify: `src/lib/audio/quota.test.ts`

- [ ] **Step 1: Add tests for `reserveAudioGeneration`**

Append to `src/lib/audio/quota.test.ts`:

```ts
import { reserveAudioGeneration } from "./quota";

function makeRpcSupabase(rpcResult: { data: unknown; error: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) };
}

describe("reserveAudioGeneration", () => {
  it("returns the new event id on success", async () => {
    const supabase = makeRpcSupabase({ data: "evt-new", error: null });
    const result = await reserveAudioGeneration(
      { userId: "u", meditationId: "m", retryOfEventId: null },
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(result).toEqual({ ok: true, eventId: "evt-new" });
    expect(supabase.rpc).toHaveBeenCalledWith("reserve_audio_generation", {
      p_user_id: "u",
      p_meditation_id: "m",
      p_per_user_cap: 3,
      p_global_cap: 500,
      p_retry_of: null,
    });
  });

  it("maps quota_exceeded", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "quota_exceeded" } });
    const result = await reserveAudioGeneration(
      { userId: "u", meditationId: "m", retryOfEventId: null },
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(result).toEqual({ ok: false, reason: "quota_exceeded" });
  });

  it("maps global_cap_reached", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "global_cap_reached" } });
    const result = await reserveAudioGeneration(
      { userId: "u", meditationId: "m", retryOfEventId: null },
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(result).toEqual({ ok: false, reason: "global_cap_reached" });
  });

  it("maps invalid_retry", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "invalid_retry" } });
    const result = await reserveAudioGeneration(
      { userId: "u", meditationId: "m", retryOfEventId: "evt-x" },
      supabase as never,
      { perUserCap: 3, globalCap: 500 },
    );
    expect(result).toEqual({ ok: false, reason: "invalid_retry" });
  });

  it("rethrows unknown errors", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "connection refused" } });
    await expect(
      reserveAudioGeneration(
        { userId: "u", meditationId: "m", retryOfEventId: null },
        supabase as never,
        { perUserCap: 3, globalCap: 500 },
      ),
    ).rejects.toThrow(/connection refused/);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test -- quota.test`

Expected: failures — `reserveAudioGeneration` not exported.

- [ ] **Step 3: Implement `reserveAudioGeneration`**

Append to `src/lib/audio/quota.ts`:

```ts
export type ReserveInput = {
  userId: string;
  meditationId: string;
  retryOfEventId: string | null;
};

export type ReserveOutcome =
  | { ok: true; eventId: string }
  | { ok: false; reason: "quota_exceeded" | "global_cap_reached" | "invalid_retry" };

const MAPPED_REASONS = new Set(["quota_exceeded", "global_cap_reached", "invalid_retry"]);

export async function reserveAudioGeneration(
  input: ReserveInput,
  supabase: SupabaseClient,
  config: QuotaConfig = getQuotaConfig(),
): Promise<ReserveOutcome> {
  const { data, error } = await supabase.rpc("reserve_audio_generation", {
    p_user_id: input.userId,
    p_meditation_id: input.meditationId,
    p_per_user_cap: config.perUserCap,
    p_global_cap: config.globalCap,
    p_retry_of: input.retryOfEventId,
  });

  if (error) {
    const reason = error.message?.trim();
    if (reason && MAPPED_REASONS.has(reason)) {
      return { ok: false, reason: reason as ReserveOutcome["reason"] };
    }
    throw new Error(`reserve_audio_generation failed: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error("reserve_audio_generation returned non-string");
  }
  return { ok: true, eventId: data };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- quota.test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/quota.ts src/lib/audio/quota.test.ts
git commit -m "feat: reserveAudioGeneration wrapper"
```

---

## Task 8: Wire quota into the route handler

**Files:**
- Create: `src/lib/supabase/service-role.ts`
- Modify: `src/app/api/audio/generate/route.ts`

- [ ] **Step 1: Create the service-role client factory**

The codebase has `client.ts` and `server.ts` factories but not yet a service-role one (today, `workflow.ts` builds it inline). CLAUDE.md prescribes the factory pattern, so add it here.

Create `src/lib/supabase/service-role.ts`:

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Service-role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Replace `route.ts` with the quota-aware version**

Replace the contents of `src/app/api/audio/generate/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { processAudioWorkflow } from "@/lib/audio/workflow";
import { reserveAudioGeneration, getQuotaConfig } from "@/lib/audio/quota";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const meditationId: unknown = body?.meditationId;
  const voiceId: unknown = body?.voiceId;
  const retryOfEventId: unknown = body?.retryOfEventId ?? null;

  if (!meditationId || typeof meditationId !== "string") {
    return NextResponse.json(
      { error: "meditationId is required" },
      { status: 400 },
    );
  }
  if (retryOfEventId !== null && typeof retryOfEventId !== "string") {
    return NextResponse.json(
      { error: "retryOfEventId must be a string when provided" },
      { status: 400 },
    );
  }

  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("id, user_id, status")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    return NextResponse.json({ error: "Meditation not found" }, { status: 404 });
  }
  if (meditation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowedStatus = retryOfEventId ? "failed" : "script_ready";
  if (meditation.status !== allowedStatus) {
    return NextResponse.json(
      {
        error: `Cannot generate audio: meditation status is "${meditation.status}", expected "${allowedStatus}"`,
      },
      { status: 409 },
    );
  }

  const serviceClient = createServiceClient();
  const reserve = await reserveAudioGeneration(
    { userId: user.id, meditationId, retryOfEventId },
    serviceClient,
    getQuotaConfig(),
  );

  if (!reserve.ok) {
    if (reserve.reason === "quota_exceeded") {
      return NextResponse.json(
        { error: "Monthly limit reached", remaining: 0 },
        { status: 429 },
      );
    }
    if (reserve.reason === "global_cap_reached") {
      return NextResponse.json(
        { error: "Audio generation is temporarily unavailable. Try again next month." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "This generation can't be retried for free." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("meditations")
    .update({ status: "processing_audio", updated_at: new Date().toISOString() })
    .eq("id", meditationId);

  if (updateError) {
    // Refund the reserved slot so the user isn't charged for our failure.
    await serviceClient
      .from("audio_generation_events")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", reserve.eventId);
    return NextResponse.json(
      { error: "Failed to update meditation status" },
      { status: 500 },
    );
  }

  const run = await start(processAudioWorkflow, [
    meditationId,
    voiceId ?? null,
    reserve.eventId,
  ]);

  return NextResponse.json(
    {
      meditationId,
      runId: run.runId,
      eventId: reserve.eventId,
      status: "processing_audio",
    },
    { status: 202 },
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors. (The `processAudioWorkflow` argument-count change is addressed in Task 9; if the type-check flags it now, proceed — Task 9 fixes it.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/service-role.ts src/app/api/audio/generate/route.ts
git commit -m "feat: enforce quota in /api/audio/generate"
```

---

## Task 9: Workflow records event status

**Files:**
- Modify: `src/lib/audio/workflow.ts`

- [ ] **Step 1: Update workflow signature and helpers**

Replace `src/lib/audio/workflow.ts` with:

```ts
import { FatalError } from "workflow";

import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@supabase/supabase-js";
import { parseMeditationText } from "@/lib/meditation/parser";
import { uploadAudio, updateMeditationStatus } from "./storage";
import type { MeditationSegment, GenerationMeta } from "@/lib/meditation/types";

interface MeditationData {
  segments: MeditationSegment[];
  voiceId: string;
  backgroundMusic: string | null;
  musicVolume: number;
}

interface GenerationResult {
  audioUrl: string;
  meta: GenerationMeta;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function fetchAndParse(meditationId: string): Promise<MeditationData> {
  "use step";

  const supabase = serviceClient();
  const { data: meditation, error } = await supabase
    .from("meditations")
    .select("script, settings")
    .eq("id", meditationId)
    .single();

  if (error || !meditation) {
    throw new FatalError(`Meditation not found: ${error?.message ?? "no data"}`);
  }
  if (!meditation.script) {
    throw new FatalError("Meditation has no script to process");
  }

  const segments = parseMeditationText(meditation.script);
  if (segments.length === 0) {
    throw new FatalError("No valid segments found in meditation script");
  }

  const settings = meditation.settings ?? {};
  return {
    segments,
    voiceId: settings.voice ?? "EXAVITQu4vr4xnSDxMaL",
    backgroundMusic: settings.music ?? null,
    musicVolume: settings.volume ?? 0.15,
  };
}

async function generateAndUpload(
  meditationId: string,
  data: MeditationData,
): Promise<GenerationResult> {
  "use step";

  const snapshotId = process.env.AUDIO_SANDBOX_SNAPSHOT_ID;
  if (!snapshotId) {
    throw new FatalError("AUDIO_SANDBOX_SNAPSHOT_ID not configured");
  }

  const sandbox = await Sandbox.create({
    runtime: "node22",
    source: { type: "snapshot", snapshotId },
    timeout: 5 * 60 * 1000,
  });

  try {
    const config = JSON.stringify({
      segments: data.segments,
      voiceId: data.voiceId,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      backgroundMusic: data.backgroundMusic,
      musicVolume: data.musicVolume,
    });

    await sandbox.writeFiles([
      { path: "config.json", content: Buffer.from(config) },
    ]);

    const cmdResult = await sandbox.runCommand("node", ["generate-audio.js"]);
    if (cmdResult.exitCode !== 0) {
      const stderr = await cmdResult.stderr();
      throw new Error(`Audio generation failed (exit ${cmdResult.exitCode}): ${stderr}`);
    }

    const audioBuffer = await sandbox.readFileToBuffer({ path: "output.mp3" });
    if (!audioBuffer) {
      throw new Error("output.mp3 not found in sandbox after generation");
    }

    let meta: GenerationMeta = {};
    const resultBuffer = await sandbox.readFileToBuffer({ path: "result.json" });
    if (resultBuffer) {
      const raw = JSON.parse(resultBuffer.toString("utf-8"));
      meta = {
        tts_characters: raw.ttsCharacters,
        tts_requests: raw.ttsRequests,
        processing_time_ms: raw.processingTimeMs,
        generated_at: raw.generatedAt,
      };
    }

    const audioUrl = await uploadAudio(meditationId, audioBuffer);
    return { audioUrl, meta };
  } finally {
    await sandbox.stop({ blocking: true }).catch(() => {});
  }
}

generateAndUpload.maxRetries = 2;

async function finalize(
  meditationId: string,
  audioUrl: string,
  meta: GenerationMeta,
  eventId: string | null,
): Promise<void> {
  "use step";

  await updateMeditationStatus(meditationId, "completed", audioUrl, meta);
  if (eventId) {
    const supabase = serviceClient();
    await supabase
      .from("audio_generation_events")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", eventId);
  }
}

async function markFailed(
  meditationId: string,
  reason: string,
  eventId: string | null,
): Promise<void> {
  "use step";

  console.error(`Audio generation failed for ${meditationId}: ${reason}`);
  await updateMeditationStatus(meditationId, "failed");
  if (eventId) {
    const supabase = serviceClient();
    await supabase
      .from("audio_generation_events")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", eventId);
  }
}

export async function processAudioWorkflow(
  meditationId: string,
  voiceIdOverride: string | null = null,
  eventId: string | null = null,
) {
  "use workflow";

  try {
    const data = await fetchAndParse(meditationId);
    if (voiceIdOverride) {
      data.voiceId = voiceIdOverride;
    }
    const { audioUrl, meta } = await generateAndUpload(meditationId, data);
    await finalize(meditationId, audioUrl, meta, eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(meditationId, message, eventId);
    throw err;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Rebuild the sandbox snapshot**

This file is baked into the sandbox snapshot per `CLAUDE.md`. Rebuild and update env:

```bash
npx tsx scripts/create-sandbox-snapshot.ts
```

Copy the printed snapshot ID into `AUDIO_SANDBOX_SNAPSHOT_ID` in `.env.local`.

Expected: a new snapshot id is printed; `.env.local` is updated locally.

- [ ] **Step 4: Commit**

```bash
git add src/lib/audio/workflow.ts
git commit -m "feat: workflow updates audio generation event status"
```

---

## Task 10: `QuotaIndicator` component + dashboard wiring

**Files:**
- Create: `src/components/quota-indicator.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create the indicator component**

Create `src/components/quota-indicator.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getQuotaUsage } from "@/lib/audio/quota";
import { cn } from "@/lib/utils";

export async function QuotaIndicator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const usage = await getQuotaUsage(user.id, supabase);
  const exhausted = usage.remaining === 0;
  const resetDate = new Date(usage.resetsAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        exhausted
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
      data-testid="quota-indicator"
    >
      <div>
        <span className="font-medium">{usage.used}</span> of{" "}
        <span className="font-medium">{usage.limit}</span> audio generations used
        this month <span className="opacity-70">· resets {resetDate}</span>
      </div>
      {exhausted && (
        <div className="mt-1 text-xs">
          You've used your audio generations this month. You can still generate scripts.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the dashboard**

Modify `src/app/(app)/dashboard/page.tsx`. Add the import alongside the others at the top of the file:

```tsx
import { QuotaIndicator } from "@/components/quota-indicator";
```

Then in the default-export `DashboardPage` component, insert `<QuotaIndicator />` between the existing title-row `<div>` and the `<DashboardTabs>` block. The relevant section becomes:

```tsx
return (
  <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-sm text-muted-foreground">
          Your meditations, favorites, and collections.
        </p>
      </div>
      <Link href="/create" className="shrink-0">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Meditation</span>
        </Button>
      </Link>
    </div>

    <QuotaIndicator />

    <DashboardTabs
      defaultTab={tab}
      meditationsContent={...}
      favoritesContent={...}
      collectionsContent={...}
    />
  </div>
);
```

(The `meditationsContent` / `favoritesContent` / `collectionsContent` props are unchanged — keep their existing values.)

- [ ] **Step 3: Verify in dev**

Run: `npm run dev`

Visit `/dashboard` while logged in as a seeded user. Expected: the indicator renders showing `0 of 3 audio generations used this month · resets <next month 1>`.

- [ ] **Step 4: Commit**

```bash
git add src/components/quota-indicator.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: dashboard quota indicator"
```

---

## Task 11: Three-state generate-audio panel

**Files:**
- Modify: `src/components/generate-audio-panel.tsx`

- [ ] **Step 1: Replace the panel with the quota-aware version**

Replace `src/components/generate-audio-panel.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoicePicker } from "@/components/voice-picker";
import { Loader2, Sparkles } from "lucide-react";

const DEFAULT_VOICE_ID = "Mu5jxyqZOLIGltFpfalg"; // Jameson

export type QuotaProp = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
};

interface GenerateAudioPanelProps {
  meditationId: string;
  quota: QuotaProp;
  onStarted: () => void;
}

export function GenerateAudioPanel({
  meditationId,
  quota,
  onStarted,
}: GenerateAudioPanelProps) {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = quota.remaining === 0;
  const isLast = quota.remaining === 1;
  const resetDate = new Date(quota.resetsAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  async function submit() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationId,
          voiceId: selectedVoiceId ?? DEFAULT_VOICE_ID,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error("Monthly limit reached");
        }
        if (res.status === 503) {
          throw new Error(
            "Audio generation is temporarily paused. Please try again next month.",
          );
        }
        throw new Error(data.error ?? "Failed to start audio generation");
      }

      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
      setConfirming(false);
    }
  }

  function handlePrimaryClick() {
    if (isLast && !confirming) {
      setConfirming(true);
      return;
    }
    submit();
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Generate Audio</h2>
          <p className="text-sm text-muted-foreground">
            Select a voice and generate the audio for your meditation.
          </p>
        </div>

        <VoicePicker
          selectedVoiceId={selectedVoiceId}
          onSelect={setSelectedVoiceId}
        />

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {exhausted ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            You've used all {quota.limit} audio generations this month. Resets {resetDate}.
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This will use 1 of your {quota.remaining} remaining audio generations this month.
          </p>
        )}

        {confirming ? (
          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={generating}
              className="flex-1 gap-2"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting generation...
                </>
              ) : (
                "Confirm — use last generation"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={generating}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={handlePrimaryClick}
            disabled={generating || exhausted}
            className="w-full gap-2"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting generation...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Audio
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: errors only at the call sites of `<GenerateAudioPanel>` (missing `quota` prop) — those are fixed in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/components/generate-audio-panel.tsx
git commit -m "feat: three-state quota-aware generate audio panel"
```

---

## Task 12: AudioSection — quota plumbing + free-retry button

**Files:**
- Modify: `src/components/audio-section.tsx`

- [ ] **Step 1: Replace AudioSection with the quota-aware version**

Replace `src/components/audio-section.tsx` with:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { MeditationWithMeta, MeditationStatus } from "@/lib/meditation/types";
import { GenerateAudioPanel, type QuotaProp } from "@/components/generate-audio-panel";
import { AudioProcessingStatus } from "@/components/audio-processing-status";
import { AudioPlayer } from "@/components/audio-player";
import { getMeditationStatus } from "@/lib/meditation/actions";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AudioSectionProps {
  meditation: MeditationWithMeta;
  isOwner: boolean;
  quota: QuotaProp;
  freeRetryEventId: string | null;
}

export function AudioSection({
  meditation,
  isOwner,
  quota,
  freeRetryEventId,
}: AudioSectionProps) {
  const [status, setStatus] = useState<MeditationStatus>(meditation.status);
  const [audioUrl, setAudioUrl] = useState(meditation.audio_url);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleGenerationStarted = useCallback(() => {
    setStatus("processing_audio");
  }, []);

  const handleCompleted = useCallback(async () => {
    const result = await getMeditationStatus(meditation.id);
    setAudioUrl(result.audio_url);
    setStatus("completed");
  }, [meditation.id]);

  const handleFailed = useCallback(() => {
    setStatus("failed");
  }, []);

  async function handleFreeRetry() {
    if (!freeRetryEventId) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationId: meditation.id,
          retryOfEventId: freeRetryEventId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start retry");
      }
      setStatus("processing_audio");
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRetrying(false);
    }
  }

  if (status === "completed" && audioUrl) {
    return <AudioPlayer audioUrl={audioUrl} />;
  }

  if (status === "processing_audio") {
    return (
      <AudioProcessingStatus
        meditationId={meditation.id}
        onCompleted={handleCompleted}
        onFailed={handleFailed}
      />
    );
  }

  if (status === "failed" && isOwner) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-medium">Audio generation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Something went wrong during processing.
              {freeRetryEventId
                ? " You can retry once for free — it won't count against your monthly quota."
                : " A free retry isn't available for this meditation."}
            </p>
          </div>
          {retryError && (
            <p className="text-sm text-destructive">{retryError}</p>
          )}
          {freeRetryEventId && (
            <Button
              variant="default"
              className="gap-2"
              onClick={handleFreeRetry}
              disabled={retrying}
            >
              <RotateCcw className="h-4 w-4" />
              {retrying ? "Retrying..." : "Retry — free"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "script_ready" && isOwner) {
    return (
      <GenerateAudioPanel
        meditationId={meditation.id}
        quota={quota}
        onStarted={handleGenerationStarted}
      />
    );
  }

  return null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: errors only at the meditation page (missing `quota` and `freeRetryEventId` props) — fixed in Task 13.

- [ ] **Step 3: Commit**

```bash
git add src/components/audio-section.tsx
git commit -m "feat: AudioSection threads quota and free-retry state"
```

---

## Task 13: Meditation page — fetch quota + free-retry, pass props

**Files:**
- Modify: `src/app/(app)/meditation/[id]/page.tsx`

- [ ] **Step 1: Update the page to pre-compute quota and free-retry**

In `src/app/(app)/meditation/[id]/page.tsx`, add the imports near the top:

```tsx
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
```

Then, inside the default-export component, after `const isOwner = user?.id === meditation.user_id;`, add:

```tsx
const quota =
  user && isOwner
    ? await getQuotaUsage(user.id, supabase)
    : { used: 0, limit: 0, remaining: 0, resetsAt: new Date().toISOString() };

const freeRetry =
  user && isOwner && meditation.status === "failed"
    ? await isFreeRetryAvailable(meditation.id, user.id, supabase)
    : { available: false, eventId: null };
```

Update the `<AudioSection />` call site:

```tsx
<AudioSection
  meditation={meditation}
  isOwner={isOwner}
  quota={quota}
  freeRetryEventId={freeRetry.eventId}
/>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/meditation/\[id\]/page.tsx
git commit -m "feat: meditation page fetches quota and free-retry state"
```

---

## Task 14: Remove dead `resetMeditationStatus`

**Files:**
- Modify: `src/lib/meditation/actions.ts`

- [ ] **Step 1: Verify no remaining callers**

Run: `grep -rn "resetMeditationStatus" src/ --include="*.ts" --include="*.tsx"`

Expected: only the export in `src/lib/meditation/actions.ts` remains (the `audio-section.tsx` import was removed in Task 12).

- [ ] **Step 2: Remove the function**

Open `src/lib/meditation/actions.ts`. Delete the entire `resetMeditationStatus` function (and its surrounding `revalidatePath` call if present inside it).

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/meditation/actions.ts
git commit -m "chore: remove dead resetMeditationStatus action"
```

---

## Task 15: Env vars + ship docs

**Files:**
- Modify: `.env.example`
- Modify: `tasks/ship/02-vercel-deploy.md`

- [ ] **Step 1: Append env vars to `.env.example`**

Add to the bottom of `.env.example`:

```bash

# Audio generation quota (per-user monthly cap and global circuit breaker)
PER_USER_MONTHLY_AUDIO_LIMIT=3
MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=500
```

- [ ] **Step 2: Add the env vars to the deploy checklist**

In `tasks/ship/02-vercel-deploy.md`, find the env-vars line (currently line 19):

```
- [ ] All env vars set in Vercel (Production + Preview): Supabase keys, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `AUDIO_SANDBOX_SNAPSHOT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`
```

Replace it with:

```
- [ ] All env vars set in Vercel (Production + Preview): Supabase keys, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `AUDIO_SANDBOX_SNAPSHOT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `PER_USER_MONTHLY_AUDIO_LIMIT`, `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`
```

- [ ] **Step 3: Commit**

```bash
git add .env.example tasks/ship/02-vercel-deploy.md
git commit -m "docs: add quota env vars to .env.example and deploy checklist"
```

---

## Task 16: Manual integration test against local Supabase

**Files:**
- Create: `scripts/test-generation-quota.ts`

- [ ] **Step 1: Create the test script**

Create `scripts/test-generation-quota.ts`:

```ts
/**
 * Manual integration test for the generation quota.
 *
 * Prereqs:
 *   - supabase running locally (`supabase start`)
 *   - .env.local populated
 *
 * Usage:
 *   npx tsx scripts/test-generation-quota.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const envPath = resolve(dirname(__filename), "..", ".env.local");
process.loadEnvFile(envPath);

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function ensureUser(): Promise<string> {
  const email = `quota-test-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return data.user.id;
}

async function ensureMeditation(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("meditations")
    .insert({
      user_id: userId,
      title: "quota test",
      prompt: "x",
      status: "script_ready",
      script: "[narration] hello",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert meditation: ${error?.message}`);
  return data.id;
}

async function reserve(userId: string, meditationId: string, retryOf: string | null = null) {
  return supabase.rpc("reserve_audio_generation", {
    p_user_id: userId,
    p_meditation_id: meditationId,
    p_per_user_cap: 3,
    p_global_cap: 500,
    p_retry_of: retryOf,
  });
}

async function main() {
  console.log("== sequential per-user cap ==");
  const userId = await ensureUser();
  const m1 = await ensureMeditation(userId);
  for (let i = 1; i <= 3; i++) {
    const { data, error } = await reserve(userId, m1);
    if (error) throw new Error(`reserve ${i}: ${error.message}`);
    console.log(`  reserve ${i} → eventId ${data}`);
  }
  const fourth = await reserve(userId, m1);
  if (fourth.error?.message !== "quota_exceeded") {
    throw new Error(`expected quota_exceeded, got ${fourth.error?.message ?? "ok"}`);
  }
  console.log("  4th reserve → quota_exceeded ✓");

  console.log("== free retry on failure ==");
  const userId2 = await ensureUser();
  const m2 = await ensureMeditation(userId2);
  const first = await reserve(userId2, m2);
  if (first.error) throw new Error(first.error.message);
  await supabase
    .from("audio_generation_events")
    .update({ status: "failed", completed_at: new Date().toISOString() })
    .eq("id", first.data as string);
  const retry = await reserve(userId2, m2, first.data as string);
  if (retry.error) throw new Error(`retry reserve: ${retry.error.message}`);
  console.log(`  retry reserve → ${retry.data} ✓`);
  // double-retry should fail
  const retry2 = await reserve(userId2, m2, first.data as string);
  if (retry2.error?.message !== "invalid_retry") {
    throw new Error(`expected invalid_retry, got ${retry2.error?.message ?? "ok"}`);
  }
  console.log("  second retry → invalid_retry ✓");

  console.log("== parallel race ==");
  const userId3 = await ensureUser();
  const m3 = await ensureMeditation(userId3);
  const results = await Promise.all([reserve(userId3, m3), reserve(userId3, m3), reserve(userId3, m3), reserve(userId3, m3)]);
  const successes = results.filter((r) => !r.error).length;
  const exceeded = results.filter((r) => r.error?.message === "quota_exceeded").length;
  if (successes !== 3 || exceeded !== 1) {
    throw new Error(`expected 3 success + 1 exceeded, got ${successes}/${exceeded}`);
  }
  console.log(`  3 successes + 1 quota_exceeded ✓`);

  console.log("\nALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test**

Run: `npx tsx scripts/test-generation-quota.ts`

Expected output:
```
== sequential per-user cap ==
  reserve 1 → eventId <uuid>
  reserve 2 → eventId <uuid>
  reserve 3 → eventId <uuid>
  4th reserve → quota_exceeded ✓
== free retry on failure ==
  retry reserve → <uuid> ✓
  second retry → invalid_retry ✓
== parallel race ==
  3 successes + 1 quota_exceeded ✓

ALL CHECKS PASSED
```

- [ ] **Step 3: Commit**

```bash
git add scripts/test-generation-quota.ts
git commit -m "test: manual integration test for generation quota"
```

---

## Task 17: Manual UI verification + ship-task statuses

**Files:**
- Modify: `tasks/ship/03-generation-quota.md`
- Modify: `tasks/ship/README.md`

- [ ] **Step 1: Run dev and click through the golden path**

Run: `npm run dev`

As the seeded `alice@example.com` user, verify:
1. Dashboard shows `0 of 3 audio generations used this month · resets <date>`.
2. Generating one audio: dashboard updates to `1 of 3` after completion. Caption on panel reads "This will use 1 of your N remaining audio generations".
3. After two more, the panel shows the confirm step on the third generation (last-remaining UX). Cancel works; Confirm submits.
4. After three: dashboard turns muted-destructive; panel shows the disabled "all used" state with the reset date.
5. Manually mark one event `failed` in the DB and reload the meditation page — "Retry — free" button appears. Click it; processing kicks off without consuming quota.

If any step doesn't match, fix and retest before continuing.

- [ ] **Step 2: Update `tasks/ship/03-generation-quota.md`**

Change the `**Status:**` line from `Not started` to `Done`. Optionally add a one-line note like:

```
**Implementation:** Spec at `docs/superpowers/specs/2026-04-25-generation-quota-design.md`; plan at `docs/superpowers/plans/2026-04-25-generation-quota.md`.
```

- [ ] **Step 3: Update `tasks/ship/README.md`**

Find the row for task #03 in the status table:

```
| 03 | [Generation quota (3/month)](./03-generation-quota.md) | Not started | ElevenLabs cost protection |
```

Replace with:

```
| 03 | [Generation quota (3/month)](./03-generation-quota.md) | Done | ElevenLabs cost protection |
```

- [ ] **Step 4: Commit**

```bash
git add tasks/ship/03-generation-quota.md tasks/ship/README.md
git commit -m "docs: mark ship task 03 (generation quota) done"
```

---

## Self-Review Checklist (do this after the plan is written)

- Spec coverage: every acceptance-criteria bullet from `tasks/ship/03-generation-quota.md` is addressed by tasks 2–17.
- Race-condition test: covered in Task 16 ("parallel race" section).
- Failed-run policy: 1 free retry — implemented in Task 3 (RPC) and Task 12 (UI).
- Quota visible on dashboard: Task 10.
- Quota visible on generate panel: Task 11.
- 429/503 responses: Task 8.
- Env-var caps: Tasks 4 + 15.
- Sandbox snapshot rebuild: called out in Task 9, Step 3 (per CLAUDE.md gotcha).

If any spec requirement is missing, add a task before execution.
