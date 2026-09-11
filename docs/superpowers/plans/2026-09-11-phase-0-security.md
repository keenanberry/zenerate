# Phase 0 — Security & Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four security and correctness defects that make Zenerate unsafe to deploy publicly, and add the CI gate that keeps them closed.

**Architecture:** Four independent fixes plus a CI workflow. The script-generation endpoint gains auth and a quota mirroring the existing audio-generation ledger. Audio moves from year-long signed URLs stored in the database to short-lived URLs minted at read time from a stored storage path. The audio quota's global cap is recalibrated to the purchased ElevenLabs plan. Seed data gets an explicit production guard. Nothing here touches the sandbox snapshot.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Storage + Auth), AI SDK 6, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-11-go-live-design.md`

## Global Constraints

- **Supabase client factories are not interchangeable.** `src/lib/supabase/server.ts` in server components and route handlers, `src/lib/supabase/browser.ts` in client components, `src/lib/supabase/service-role.ts` only in trusted server code that must bypass RLS. All three export a function named `createClient`; alias on import.
- **Do not edit `src/lib/audio/generate-audio.ts`.** It is baked into the sandbox snapshot and any change requires `npx tsx scripts/create-sandbox-snapshot.ts` plus an `AUDIO_SANDBOX_SNAPSHOT_ID` update. No task in this plan needs to touch it. `src/lib/audio/workflow.ts` and `src/lib/audio/storage.ts` are app-side and safe to edit.
- **Migration filenames** follow `YYYYMMDDHHMMSS_description.sql` in `supabase/migrations/`.
- **Tests** live beside their subject as `*.test.ts` under `src/`. Vitest is configured with `environment: "node"` and the `@` → `src` alias (`vitest.config.ts`).
- **Do not change the model id** in `src/app/api/generate/route.ts`. That is ship task 18 in Phase 2.
- **Run `npm test` before every commit.**

**Ship-task mapping:** Plan Task 1 → `tasks/ship/01`, Task 2 → `03`, Task 3 → `02`, Task 4 → `04`, Task 5 → `05`. Execution order differs from the ship numbering: the endpoint fix is first because it is the highest-severity item, and CI is last so it gates a green tree.

---

## File Structure

**Created**
- `supabase/migrations/20260911000000_script_generation_events.sql` — script quota ledger + reservation RPC
- `supabase/migrations/20260911000100_meditation_audio_path.sql` — `audio_path` column + backfill
- `src/lib/ai/quota.ts` — script generation quota config and reservation
- `src/lib/ai/quota.test.ts` — unit tests for the above
- `src/app/api/generate/route.test.ts` — route-level auth and quota tests
- `src/lib/audio/signed-url.ts` — mint short-lived signed URLs, single and batch
- `src/lib/audio/signed-url.test.ts` — unit tests for the above
- `.github/workflows/ci.yml` — lint, typecheck, test, build

**Modified**
- `src/app/api/generate/route.ts` — auth, input validation, quota, output cap
- `src/components/meditation-form.tsx` — surface 401/429 from the endpoint
- `src/lib/audio/quota.ts:22` — global cap default 500 → 25
- `src/lib/audio/quota.test.ts` — assertions for the new default
- `src/lib/audio/storage.ts` — store path, not URL
- `src/lib/audio/workflow.ts:105-107` — rename through the return value
- `src/lib/meditation/actions.ts` — hydrate signed URLs in six fetchers
- `src/lib/meditation/types.ts:21` — document `audio_url` as a runtime-signed field
- `supabase/seed.sql` — production warning header
- `.env.example` — recalibrated cap, new script quota vars
- `README.md` / `CLAUDE.md` — seed guard documentation

---

## Task 1: Secure the script generation endpoint

**Ship task:** `tasks/ship/01-secure-script-endpoint.md`

`src/app/api/generate/route.ts` currently accepts an arbitrary `prompt` from anyone and streams a response billed to our Anthropic key. Task 5 of Phase 1 makes the repo public. This must land first.

Scripts are generated *before* a meditation row exists, so `audio_generation_events` cannot be reused — its `meditation_id` is `not null`. This task adds a parallel, simpler ledger with the same locking pattern.

**Files:**
- Create: `supabase/migrations/20260911000000_script_generation_events.sql`
- Create: `src/lib/ai/quota.ts`
- Create: `src/lib/ai/quota.test.ts`
- Create: `src/app/api/generate/route.test.ts`
- Modify: `src/app/api/generate/route.ts` (entire file)
- Modify: `src/components/meditation-form.tsx:100-103`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` and `@/lib/supabase/service-role`; the `ReserveOutcome` shape established in `src/lib/audio/quota.ts:118`
- Produces:
  - `getScriptQuotaConfig(): ScriptQuotaConfig` where `ScriptQuotaConfig = { perUserCap: number; globalCap: number }`
  - `reserveScriptGeneration(userId: string, supabase: SupabaseClient, config?: ScriptQuotaConfig): Promise<ScriptReserveOutcome>` where `ScriptReserveOutcome = { ok: true; eventId: string } | { ok: false; reason: "quota_exceeded" | "global_cap_reached" }`
  - `MAX_PROMPT_CHARS: number` exported from `src/lib/ai/quota.ts`

---

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260911000000_script_generation_events.sql`:

```sql
-- Script generation events: append-only ledger of every Anthropic script
-- generation. Mirrors audio_generation_events but simpler -- scripts are
-- generated before a meditation row exists, so there is no meditation_id,
-- no retry concept, and no status machine.

create table public.script_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year_month text not null,
  created_at timestamptz not null default now()
);

create or replace function public.script_gen_events_set_year_month()
returns trigger language plpgsql as $$
begin
  new.year_month := to_char(new.created_at, 'YYYY-MM');
  return new;
end;
$$;

create trigger script_gen_events_year_month_trigger
  before insert on public.script_generation_events
  for each row execute function public.script_gen_events_set_year_month();

alter table public.script_generation_events enable row level security;

create policy "select_own" on public.script_generation_events
  for select using (auth.uid() = user_id);

create index idx_script_gen_user_month
  on public.script_generation_events(user_id, year_month);

create index idx_script_gen_global_month
  on public.script_generation_events(year_month);

-- Atomic check-and-reserve. Caller is the service-role client from the
-- /api/generate route handler. Returns the new event id or raises one of:
-- 'quota_exceeded', 'global_cap_reached'.
create or replace function public.reserve_script_generation(
  p_user_id uuid,
  p_per_user_cap integer,
  p_global_cap integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_count integer;
  v_global_count integer;
  v_year_month text := to_char(now(), 'YYYY-MM');
begin
  perform pg_advisory_xact_lock(hashtext('script_generation_global'));
  perform pg_advisory_xact_lock(hashtext('script:' || p_user_id::text));

  select count(*) into v_global_count
    from public.script_generation_events
    where year_month = v_year_month;

  if v_global_count >= p_global_cap then
    raise exception 'global_cap_reached' using errcode = 'P0002';
  end if;

  select count(*) into v_user_count
    from public.script_generation_events
    where user_id = p_user_id
      and year_month = v_year_month;

  if v_user_count >= p_per_user_cap then
    raise exception 'quota_exceeded' using errcode = 'P0003';
  end if;

  insert into public.script_generation_events (user_id)
  values (p_user_id)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.reserve_script_generation(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_script_generation(uuid, integer, integer)
  to service_role;
```

- [ ] **Step 2: Apply the migration and verify it lands**

Run: `supabase db reset`
Expected: completes without error. Then verify the function exists:

Run: `supabase db reset && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\df public.reserve_script_generation"`
Expected: one row listing `reserve_script_generation`.

- [ ] **Step 3: Write the failing quota tests**

Create `src/lib/ai/quota.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getScriptQuotaConfig, reserveScriptGeneration, MAX_PROMPT_CHARS } from "./quota";

describe("getScriptQuotaConfig", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.PER_USER_MONTHLY_SCRIPT_LIMIT;
    delete process.env.MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns defaults when env vars unset", () => {
    const cfg = getScriptQuotaConfig();
    expect(cfg.perUserCap).toBe(30);
    expect(cfg.globalCap).toBe(300);
  });

  it("reads positive integer env vars", () => {
    process.env.PER_USER_MONTHLY_SCRIPT_LIMIT = "5";
    process.env.MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS = "50";
    const cfg = getScriptQuotaConfig();
    expect(cfg.perUserCap).toBe(5);
    expect(cfg.globalCap).toBe(50);
  });

  it("throws on non-numeric env vars", () => {
    process.env.PER_USER_MONTHLY_SCRIPT_LIMIT = "lots";
    expect(() => getScriptQuotaConfig()).toThrow(/PER_USER_MONTHLY_SCRIPT_LIMIT/);
  });
});

function makeRpcSupabase(rpcResult: { data: unknown; error: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) };
}

describe("reserveScriptGeneration", () => {
  const config = { perUserCap: 30, globalCap: 300 };

  it("returns the new event id on success", async () => {
    const supabase = makeRpcSupabase({ data: "evt-1", error: null });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: true, eventId: "evt-1" });
    expect(supabase.rpc).toHaveBeenCalledWith("reserve_script_generation", {
      p_user_id: "user-1",
      p_per_user_cap: 30,
      p_global_cap: 300,
    });
  });

  it("maps quota_exceeded", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "quota_exceeded" } });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: false, reason: "quota_exceeded" });
  });

  it("maps global_cap_reached", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "global_cap_reached" } });
    const result = await reserveScriptGeneration("user-1", supabase as never, config);
    expect(result).toEqual({ ok: false, reason: "global_cap_reached" });
  });

  it("rethrows unknown errors", async () => {
    const supabase = makeRpcSupabase({ data: null, error: { message: "connection refused" } });
    await expect(
      reserveScriptGeneration("user-1", supabase as never, config),
    ).rejects.toThrow(/connection refused/);
  });
});

describe("MAX_PROMPT_CHARS", () => {
  it("is a sane positive cap", () => {
    expect(MAX_PROMPT_CHARS).toBeGreaterThan(500);
    expect(MAX_PROMPT_CHARS).toBeLessThan(20000);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- src/lib/ai/quota.test.ts`
Expected: FAIL — `Failed to resolve import "./quota"`.

- [ ] **Step 5: Implement the quota module**

Create `src/lib/ai/quota.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upper bound on a single generation prompt. The wizard's generated prompts
 * are a few hundred characters; this is an abuse guard, not a product limit.
 */
export const MAX_PROMPT_CHARS = 4000;

export type ScriptQuotaConfig = {
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

/**
 * Script generation is ~$0.02 per call, so these caps are deliberately
 * generous. They exist to stop an open endpoint being used as a free Claude
 * proxy, not to ration the product.
 */
export function getScriptQuotaConfig(): ScriptQuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_SCRIPT_LIMIT", 30),
    globalCap: readPositiveInt("MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS", 300),
  };
}

export type ScriptReserveOutcome =
  | { ok: true; eventId: string }
  | { ok: false; reason: "quota_exceeded" | "global_cap_reached" };

const MAPPED_REASONS = new Set(["quota_exceeded", "global_cap_reached"]);

export async function reserveScriptGeneration(
  userId: string,
  supabase: SupabaseClient,
  config: ScriptQuotaConfig = getScriptQuotaConfig(),
): Promise<ScriptReserveOutcome> {
  const { data, error } = await supabase.rpc("reserve_script_generation", {
    p_user_id: userId,
    p_per_user_cap: config.perUserCap,
    p_global_cap: config.globalCap,
  });

  if (error) {
    const reason = error.message?.trim();
    if (reason && MAPPED_REASONS.has(reason)) {
      return {
        ok: false,
        reason: reason as Extract<ScriptReserveOutcome, { ok: false }>["reason"],
      };
    }
    throw new Error(`reserve_script_generation failed: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error("reserve_script_generation returned non-string");
  }
  return { ok: true, eventId: data };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/lib/ai/quota.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Write the failing route tests**

Create `src/app/api/generate/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockReserve = vi.fn();
const mockStreamText = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createClient: () => ({}),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (id: string) => ({ id }),
}));
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => {
    mockStreamText(...args);
    return { toTextStreamResponse: () => new Response("script text", { status: 200 }) };
  },
}));
vi.mock("@/lib/ai/quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/quota")>();
  return { ...actual, reserveScriptGeneration: mockReserve };
});

import { POST } from "./route";
import { MAX_PROMPT_CHARS } from "@/lib/ai/quota";

function post(body: unknown) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockReserve.mockResolvedValue({ ok: true, eventId: "evt-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(401);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is not a string", async () => {
    const res = await POST(post({ prompt: 42 }));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt exceeds the character cap", async () => {
    const res = await POST(post({ prompt: "x".repeat(MAX_PROMPT_CHARS + 1) }));
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 429 when the user is over quota", async () => {
    mockReserve.mockResolvedValue({ ok: false, reason: "quota_exceeded" });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(429);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 503 when the global cap is reached", async () => {
    mockReserve.mockResolvedValue({ ok: false, reason: "global_cap_reached" });
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(503);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("streams when authenticated and within quota", async () => {
    const res = await POST(post({ prompt: "make me a meditation" }));
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });

  it("caps output tokens on the model call", async () => {
    await POST(post({ prompt: "make me a meditation" }));
    const args = mockStreamText.mock.calls[0][0] as { maxOutputTokens?: number };
    expect(args.maxOutputTokens).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 8: Run the route tests to verify they fail**

Run: `npm test -- src/app/api/generate/route.test.ts`
Expected: FAIL — the current handler has no auth, so the 401 test fails and `streamText` is called.

- [ ] **Step 9: Rewrite the route handler**

Replace the entire contents of `src/app/api/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MEDITATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import {
  getScriptQuotaConfig,
  reserveScriptGeneration,
  MAX_PROMPT_CHARS,
} from "@/lib/ai/quota";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prompt: unknown = body?.prompt;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "prompt is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `prompt must be ${MAX_PROMPT_CHARS} characters or fewer` },
      { status: 400 },
    );
  }

  const reserve = await reserveScriptGeneration(
    user.id,
    createServiceClient(),
    getScriptQuotaConfig(),
  );

  if (!reserve.ok) {
    if (reserve.reason === "quota_exceeded") {
      return NextResponse.json(
        { error: "You've reached your monthly script generation limit." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Script generation is temporarily unavailable. Try again next month." },
      { status: 503 },
    );
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: MEDITATION_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 8000,
  });

  return result.toTextStreamResponse();
}
```

- [ ] **Step 10: Run the route tests to verify they pass**

Run: `npm test -- src/app/api/generate/route.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 11: Surface the errors in the wizard**

In `src/components/meditation-form.tsx`, add an error state next to the existing state declarations (after line 98's `selectedTemplate`):

```tsx
  const [generateError, setGenerateError] = useState<string | null>(null);
```

Change the `useCompletion` call (currently lines 100-103) to:

```tsx
  const { completion, isLoading, complete } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
    onError: (error) => {
      setGenerateError(
        error.message ||
          "Something went wrong generating your script. Please try again.",
      );
    },
  });
```

Clear the error at the start of both `handleGenerate` and `handleRegenerate` by adding this as the first line of each function body:

```tsx
    setGenerateError(null);
```

Then render it. Find the Generate step's JSX and add directly above the generate button:

```tsx
        {generateError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {generateError}
          </p>
        )}
```

- [ ] **Step 12: Add the new env vars**

In `.env.example`, below the existing audio quota block, add:

```bash
# Script generation quota (Anthropic abuse guard, not a product limit).
# Scripts cost ~$0.02 each; these caps exist so a public endpoint can't be
# used as a free Claude proxy.
PER_USER_MONTHLY_SCRIPT_LIMIT=30
MAX_GLOBAL_MONTHLY_SCRIPT_GENERATIONS=300
```

- [ ] **Step 13: Verify the full flow by hand**

Run: `npm run dev`

Check each of these:
1. Signed out, run `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/generate -H 'Content-Type: application/json' -d '{"prompt":"test"}'` → expect `401`
2. Signed in as `alice@example.com`, generate a script through the wizard → succeeds
3. `psql` the local DB: `select count(*) from script_generation_events;` → one row
4. Set `PER_USER_MONTHLY_SCRIPT_LIMIT=1` in `.env.local`, restart, generate again → the wizard shows the limit message rather than failing silently

- [ ] **Step 14: Run the full suite and commit**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all pass.

```bash
git add supabase/migrations/20260911000000_script_generation_events.sql \
        src/lib/ai/quota.ts src/lib/ai/quota.test.ts \
        src/app/api/generate/route.ts src/app/api/generate/route.test.ts \
        src/components/meditation-form.tsx .env.example
git commit -m "Require auth and enforce a quota on script generation

/api/generate accepted an arbitrary prompt from anyone and streamed a
response billed to our Anthropic key. Adds an auth check, input
validation, an output token cap, and a per-user monthly quota backed by
a new script_generation_events ledger mirroring the audio one.

Closes tasks/ship/01."
```

---

## Task 2: Recalibrate the audio generation quota

**Ship task:** `tasks/ship/03-recalibrate-quota.md`

The quota system shipped in `0e7b15f`. Only its calibration is wrong: `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=500` × ~930 measured characters ≈ 465k credits/month, which is ElevenLabs Pro. The purchased plan is Starter, 30k credits ≈ 32 generations.

**Files:**
- Modify: `src/lib/audio/quota.ts:22`
- Modify: `src/lib/audio/quota.test.ts:25` and `:34`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: no new symbols; `getQuotaConfig()` keeps its signature, only the `globalCap` default changes from `500` to `25`

---

- [ ] **Step 1: Update the failing test first**

In `src/lib/audio/quota.test.ts`, change the default assertion (currently line 25):

```ts
    expect(cfg.globalCap).toBe(25);
```

Leave the explicit-env test at line 34 (`toBe(1000)`) alone — it sets the var and asserts the parse, which is still correct.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/audio/quota.test.ts`
Expected: FAIL — `expected 500 to be 25`.

- [ ] **Step 3: Change the default**

In `src/lib/audio/quota.ts`, replace the `getQuotaConfig` function:

```ts
/**
 * Caps are derived from the purchased ElevenLabs plan, not chosen freely.
 *
 *   Starter: 30,000 credits/month
 *   Measured: ~930 speech characters per meditation
 *   30,000 / 930 = ~32 generations, minus headroom for retries and
 *   longer-than-average scripts = 25
 *
 * Revisit this whenever the ElevenLabs plan changes. On Creator (121k
 * credits) the equivalent figure is ~100.
 */
export function getQuotaConfig(): QuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_AUDIO_LIMIT", 3),
    globalCap: readPositiveInt("MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH", 25),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/audio/quota.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `.env.example`**

Replace the existing audio quota block:

```bash
# Audio generation quota (per-user monthly cap and global circuit breaker).
#
# MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH is DERIVED FROM THE ELEVENLABS PLAN:
#   Starter (30k credits) / ~930 chars per meditation = ~32, minus headroom = 25
#   Creator (121k credits) would be ~100
# Update it whenever the plan changes, or the circuit breaker will sit above
# the real ceiling and ElevenLabs will cut us off first.
PER_USER_MONTHLY_AUDIO_LIMIT=3
MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=25
```

- [ ] **Step 6: Verify the breaker actually fires**

Set `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH=1` in `.env.local`, restart `npm run dev`, and generate audio twice as `alice@example.com`.
Expected: the second attempt returns HTTP 503 and the UI shows "temporarily unavailable". Revert `.env.local` afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/lib/audio/quota.ts src/lib/audio/quota.test.ts .env.example
git commit -m "Recalibrate the audio global cap to the ElevenLabs Starter plan

500 generations/month implied ~465k credits, which is Pro tier. The
purchased plan is Starter at 30k credits, which covers ~32 generations
at the measured ~930 speech characters each. Sets the cap to 25 and
documents the derivation so it moves with the plan.

Closes tasks/ship/03."
```

---

## Task 3: Audio URL lifetime and privacy

**Ship task:** `tasks/ship/02-audio-url-lifetime.md`

`src/lib/audio/storage.ts:39` mints a 365-day signed URL and persists it. It expires, and it is a bearer token that bypasses `is_public` and RLS.

The approach keeps the client-facing field name `audio_url` and changes only its source and lifetime. The database stores a path; server-side code signs it on read. Client components need no changes.

**Deviation from the spec:** the spec suggested a 1-hour TTL. This plan uses **4 hours**. A user may open a meditation, read the script, and play it much later in the same session, and wavesurfer re-requests the file on seek. Four hours is comfortably longer than any single session and still 2,190× shorter than a year.

**Files:**
- Create: `supabase/migrations/20260911000100_meditation_audio_path.sql`
- Create: `src/lib/audio/signed-url.ts`
- Create: `src/lib/audio/signed-url.test.ts`
- Modify: `src/lib/audio/storage.ts:19-47` and `:50-77`
- Modify: `src/lib/audio/workflow.ts:105-107`
- Modify: `src/lib/meditation/actions.ts` — six fetchers
- Modify: `src/lib/meditation/types.ts:21`

**Interfaces:**
- Consumes: nothing from Tasks 1–2
- Produces:
  - `AUDIO_URL_TTL_SECONDS: number` (14400)
  - `signAudioUrl(path: string | null, supabase: SupabaseClient): Promise<string | null>`
  - `signAudioUrls(paths: Array<string | null>, supabase: SupabaseClient): Promise<Array<string | null>>` — order-preserving, one round trip
  - `uploadAudio(meditationId, audioBuffer)` now returns the storage **path**, not a URL
  - `updateMeditationStatus(meditationId, status, audioPath?, generationMeta?)` — third parameter is now a path

---

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260911000100_meditation_audio_path.sql`:

```sql
-- Audio was stored as a 1-year signed URL, which both expires and acts as a
-- bearer token that bypasses is_public and RLS. Store the storage path
-- instead and sign short-lived URLs at read time.

alter table public.meditations add column audio_path text;

-- Backfill from existing signed URLs. They look like:
--   {base}/storage/v1/object/sign/meditation-audio/{path}?token=...
update public.meditations
set audio_path = split_part(split_part(audio_url, '/meditation-audio/', 2), '?', 1)
where audio_url is not null
  and audio_url like '%/meditation-audio/%';

-- Any row with audio but no parsable path is a data problem worth seeing.
-- Fall back to the conventional path, which is how uploadAudio names files.
update public.meditations
set audio_path = id::text || '.mp3'
where audio_url is not null and audio_path is null;

comment on column public.meditations.audio_path is
  'Storage path within the meditation-audio bucket. Sign at read time; never store a signed URL here.';

comment on column public.meditations.audio_url is
  'DEPRECATED - retained for rollback only. Read audio_path and sign it instead.';
```

- [ ] **Step 2: Apply and verify the backfill**

Run: `supabase db reset`
Then check the backfill logic against a synthetic row:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c \
  "select split_part(split_part('http://127.0.0.1:54321/storage/v1/object/sign/meditation-audio/abc-123.mp3?token=xyz', '/meditation-audio/', 2), '?', 1) as parsed;"
```
Expected: `abc-123.mp3`.

- [ ] **Step 3: Write the failing signing tests**

Create `src/lib/audio/signed-url.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { signAudioUrl, signAudioUrls, AUDIO_URL_TTL_SECONDS } from "./signed-url";

function makeStorage(impl: {
  createSignedUrl?: unknown;
  createSignedUrls?: unknown;
}) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: impl.createSignedUrl,
        createSignedUrls: impl.createSignedUrls,
      }),
    },
  };
}

describe("AUDIO_URL_TTL_SECONDS", () => {
  it("is four hours", () => {
    expect(AUDIO_URL_TTL_SECONDS).toBe(4 * 60 * 60);
  });
});

describe("signAudioUrl", () => {
  it("returns null for a null path without calling storage", async () => {
    const supabase = makeStorage({ createSignedUrl: vi.fn() });
    const result = await signAudioUrl(null, supabase as never);
    expect(result).toBeNull();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("signs a path with the configured TTL", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed/abc" }, error: null });
    const supabase = makeStorage({ createSignedUrl });
    const result = await signAudioUrl("abc.mp3", supabase as never);
    expect(result).toBe("https://signed/abc");
    expect(createSignedUrl).toHaveBeenCalledWith("abc.mp3", AUDIO_URL_TTL_SECONDS);
  });

  it("returns null rather than throwing when signing fails", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "object not found" } });
    const supabase = makeStorage({ createSignedUrl });
    const result = await signAudioUrl("missing.mp3", supabase as never);
    expect(result).toBeNull();
  });
});

describe("signAudioUrls", () => {
  it("returns an empty array without calling storage when given no paths", async () => {
    const supabase = makeStorage({ createSignedUrls: vi.fn() });
    const result = await signAudioUrls([], supabase as never);
    expect(result).toEqual([]);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("preserves order and null slots", async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: "a.mp3", signedUrl: "https://signed/a", error: null },
        { path: "b.mp3", signedUrl: "https://signed/b", error: null },
      ],
      error: null,
    });
    const supabase = makeStorage({ createSignedUrls });
    const result = await signAudioUrls(["a.mp3", null, "b.mp3"], supabase as never);
    expect(result).toEqual(["https://signed/a", null, "https://signed/b"]);
    expect(createSignedUrls).toHaveBeenCalledWith(["a.mp3", "b.mp3"], AUDIO_URL_TTL_SECONDS);
  });

  it("returns all nulls when the batch call errors", async () => {
    const createSignedUrls = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "bucket missing" } });
    const supabase = makeStorage({ createSignedUrls });
    const result = await signAudioUrls(["a.mp3", "b.mp3"], supabase as never);
    expect(result).toEqual([null, null]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- src/lib/audio/signed-url.test.ts`
Expected: FAIL — `Failed to resolve import "./signed-url"`.

- [ ] **Step 5: Implement the signing helpers**

Create `src/lib/audio/signed-url.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "meditation-audio";

/**
 * How long a minted audio URL stays valid. Long enough that a user can open a
 * meditation, read the script, and play it later in the same session --
 * wavesurfer re-requests the file on seek -- and short enough that a leaked
 * link is not a permanent grant.
 */
export const AUDIO_URL_TTL_SECONDS = 4 * 60 * 60;

/**
 * Sign a single storage path. Returns null on a null path or a signing
 * failure -- callers render a "no audio" state rather than a broken player,
 * and a missing object should not take down the page.
 */
export async function signAudioUrl(
  path: string | null,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, AUDIO_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error(`Failed to sign audio path "${path}": ${error?.message}`);
    return null;
  }
  return data.signedUrl;
}

/**
 * Sign many paths in one round trip, preserving input order and null slots.
 * List views render dozens of meditations; signing them individually would be
 * one network call each.
 */
export async function signAudioUrls(
  paths: Array<string | null>,
  supabase: SupabaseClient,
): Promise<Array<string | null>> {
  const present = paths.filter((p): p is string => Boolean(p));
  if (present.length === 0) return paths.map(() => null);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(present, AUDIO_URL_TTL_SECONDS);

  if (error || !data) {
    console.error(`Failed to batch-sign audio paths: ${error?.message}`);
    return paths.map(() => null);
  }

  const byPath = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) {
      byPath.set(entry.path, entry.signedUrl);
    }
  }

  return paths.map((p) => (p ? byPath.get(p) ?? null : null));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/lib/audio/signed-url.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Stop persisting signed URLs**

In `src/lib/audio/storage.ts`, replace `uploadAudio` and `updateMeditationStatus`:

```ts
/**
 * Upload an MP3 buffer to Supabase Storage and return its storage PATH.
 *
 * Deliberately not a URL: a signed URL is a bearer token that bypasses
 * is_public and RLS, and one with a useful lifetime eventually expires.
 * Sign at read time with signAudioUrl / signAudioUrls instead.
 */
export async function uploadAudio(
  meditationId: string,
  audioBuffer: Buffer,
): Promise<string> {
  const supabase = createServiceClient();
  const filePath = `${meditationId}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  return filePath;
}

/**
 * Update a meditation record's status and optional audio_path / generation_meta.
 */
export async function updateMeditationStatus(
  meditationId: string,
  status: string,
  audioPath?: string,
  generationMeta?: GenerationMeta,
): Promise<void> {
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (audioPath !== undefined) {
    update.audio_path = audioPath;
  }
  if (generationMeta !== undefined) {
    update.generation_meta = generationMeta;
  }

  const { error } = await supabase
    .from("meditations")
    .update(update)
    .eq("id", meditationId);

  if (error) {
    throw new Error(`Status update failed: ${error.message}`);
  }
}
```

- [ ] **Step 8: Rename through the workflow**

In `src/lib/audio/workflow.ts`, the `GenerationResult` interface (lines 17-20) becomes:

```ts
interface GenerationResult {
  audioPath: string;
  meta: GenerationMeta;
}
```

At the end of `generateAndUpload` (currently line 106), change:

```ts
    const audioPath = await uploadAudio(meditationId, audioBuffer);
    return { audioPath, meta };
```

Change the `finalize` signature (line 118) and body:

```ts
async function finalize(
  meditationId: string,
  audioPath: string,
  meta: GenerationMeta,
  eventId: string | null,
): Promise<void> {
  "use step";

  await updateMeditationStatus(meditationId, "completed", audioPath, meta);
```

And in `processAudioWorkflow` (line 165):

```ts
    const { audioPath, meta } = await generateAndUpload(meditationId, data);
    await finalize(meditationId, audioPath, meta, eventId);
```

- [ ] **Step 9: Hydrate signed URLs in the fetchers**

In `src/lib/meditation/actions.ts`, add the import at the top:

```ts
import { signAudioUrl, signAudioUrls } from "@/lib/audio/signed-url";
```

Add this helper below the imports:

```ts
/**
 * Rows come back with audio_path; every consumer expects audio_url. Sign the
 * path into a short-lived URL so client components need no changes.
 */
async function hydrateAudioUrl<T extends { audio_path?: string | null }>(
  row: T,
  supabase: SupabaseClient,
): Promise<T & { audio_url: string | null }> {
  return { ...row, audio_url: await signAudioUrl(row.audio_path ?? null, supabase) };
}

async function hydrateAudioUrls<T extends { audio_path?: string | null }>(
  rows: T[],
  supabase: SupabaseClient,
): Promise<Array<T & { audio_url: string | null }>> {
  const urls = await signAudioUrls(rows.map((r) => r.audio_path ?? null), supabase);
  return rows.map((row, i) => ({ ...row, audio_url: urls[i] }));
}
```

Add `import type { SupabaseClient } from "@supabase/supabase-js";` if not already present.

Apply it at all six fetchers:

| Function | Line | Change |
|---|---|---|
| `getMeditation` | 69 | `return hydrateAudioUrl(meditation, supabase);` in place of `return meditation;` |
| `getUserMeditations` | 98 | wrap the returned array in `hydrateAudioUrls(..., supabase)` |
| `getPublicMeditations` | 128 | wrap the returned array in `hydrateAudioUrls(..., supabase)` |
| `getMeditationStatus` | 167 | select `status, audio_path`; return `{ status, audio_url: await signAudioUrl(data.audio_path, supabase) }` |
| `getFavoriteMeditations` | 210 | wrap the returned array in `hydrateAudioUrls(..., supabase)` |
| `getCollectionWithItems` | 319 | wrap the nested meditations array in `hydrateAudioUrls(..., supabase)` |

- [ ] **Step 10: Document the type**

In `src/lib/meditation/types.ts`, replace line 21:

```ts
  /** Short-lived signed URL, minted server-side at read time. Never persisted. */
  audio_url: string | null;
  /** Storage path within the meditation-audio bucket. This is what the DB holds. */
  audio_path?: string | null;
```

- [ ] **Step 11: Run the full suite**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. Typecheck will flag any fetcher missed in Step 9.

- [ ] **Step 12: Verify end to end**

Run: `supabase db reset && npm run dev`

1. Sign in as `alice@example.com`, open a completed seeded meditation → audio plays
2. Copy the audio URL from devtools Network; confirm it contains `?token=` and is not the value in the DB (`select audio_url, audio_path from meditations limit 1;` → `audio_path` is a bare filename)
3. Open `/dashboard` and `/discover` → inline play buttons work on list cards
4. Generate fresh audio end to end → completes, plays, and `audio_path` is populated on the new row
5. Sign out, open a **public** meditation → audio plays
6. Confirm a private meditation's page 404s or hides audio for a signed-out visitor

- [ ] **Step 13: Commit**

```bash
git add supabase/migrations/20260911000100_meditation_audio_path.sql \
        src/lib/audio/signed-url.ts src/lib/audio/signed-url.test.ts \
        src/lib/audio/storage.ts src/lib/audio/workflow.ts \
        src/lib/meditation/actions.ts src/lib/meditation/types.ts
git commit -m "Store audio storage paths and sign URLs at read time

Persisting a 1-year signed URL meant every meditation's audio silently
404s a year after generation, and the URL acted as a bearer token that
bypassed is_public and RLS -- a private meditation's audio was readable
by anyone holding the link.

Stores the storage path instead and mints a 4-hour signed URL in the six
server-side fetchers. The client-facing audio_url field keeps its name,
so no component changes.

Closes tasks/ship/02."
```

---

## Task 4: Seed data production guard

**Ship task:** `tasks/ship/04-seed-data-prod-guard.md`

`supabase/seed.sql` creates `alice@example.com` and `bob@example.com` with password `password123`. Nothing currently states that it must never reach production.

**Files:**
- Modify: `supabase/seed.sql` (header)
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing
- Produces: nothing — documentation and verification only

---

- [ ] **Step 1: Add the warning header**

Insert at the very top of `supabase/seed.sql`, above the existing comment:

```sql
-- ############################################################
-- #  LOCAL DEVELOPMENT ONLY -- NEVER APPLY TO PRODUCTION     #
-- #                                                          #
-- #  Creates test users with the password "password123".     #
-- #  Applied by `supabase db reset`, which also DROPS all    #
-- #  existing data. Production uses `supabase db push`,      #
-- #  which applies migrations only and never runs this file. #
-- #                                                          #
-- #  If you are pointed at a linked production project,      #
-- #  `db reset` will destroy real user data.                 #
-- ############################################################
```

- [ ] **Step 2: Verify `db push` does not run seeds**

Run: `supabase db push --help`
Confirm the help text describes migration application only, with no seed step. Record the confirmation in the task file's acceptance criteria.

- [ ] **Step 3: Audit for automated seed paths**

Run: `grep -rn "db reset\|seed.sql" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.md" . --exclude-dir=node_modules --exclude-dir=.next`
Expected: hits only in documentation and this plan — no CI workflow, deploy hook, or script invokes `db reset`. If Task 5's workflow appears here later, confirm it does not run against a remote database.

- [ ] **Step 4: Document in README and CLAUDE.md**

In `README.md` and in `CLAUDE.md`'s Local Dev section, annotate the `supabase db reset` line:

```markdown
supabase db reset              # applies migrations + seed data — LOCAL ONLY, destroys all data
```

Add below the code block in both files:

> **Never run `supabase db reset` against a linked production project.** It drops all data and applies `supabase/seed.sql`, which creates test accounts with a known password. Production migrations go out with `supabase db push`, which applies migrations only by default — never pass `--include-seed` against a linked production project, or it will apply this same file.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql README.md CLAUDE.md
git commit -m "Guard seed data against production

seed.sql creates test users with a known password and is applied by
db reset, which also drops existing data. Adds an unmissable header and
documents the db reset / db push distinction in README and CLAUDE.md.

Closes tasks/ship/04."
```

---

## Task 5: CI pipeline

**Ship task:** `tasks/ship/05-ci-pipeline.md`

No `.github/` directory exists. This task also resolves the uncommitted `package-lock.json` drift, because `npm ci` requires the lockfile and `package.json` to agree.

**Files:**
- Create: `.github/workflows/ci.yml`
- Possibly modify: `package-lock.json` (decision in Step 1)

**Interfaces:**
- Consumes: a green test suite from Tasks 1–4
- Produces: nothing consumed by later tasks

---

- [ ] **Step 1: Resolve the lockfile drift**

`package-lock.json` is modified in the working tree with ~9.7k insertions and ~13.8k deletions. Its mtime matches `node_modules`, one minute after `package.json` — an `npm install` during worktree setup regenerated it, pruning `@aws-crypto/*` and `@smithy/*` peer entries from `@vercel/sandbox`'s tree.

Decide by testing the regenerated tree:

```bash
rm -rf node_modules
npm ci
npm test && npm run lint && npx tsc --noEmit && npm run build
```

- If all pass: the regenerated lockfile is good. `git add package-lock.json` and include it in this task's commit.
- If `npm ci` fails or the build breaks: `git checkout package-lock.json`, then `rm -rf node_modules && npm ci` to restore the committed tree, and re-verify.

Do not proceed until `npm ci` succeeds from a clean `node_modules`. CI runs `npm ci`, so a lockfile that only works with `npm install` will fail there.

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      # Catches a class of Next.js error that tsc alone misses. The dummy
      # values only need to be present and well-formed -- nothing here
      # reaches a real service, and no secrets are required.
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-build
          SUPABASE_SERVICE_ROLE_KEY: dummy-service-role-key-for-build
```

- [ ] **Step 3: Confirm `npm run lint` resolves the flat config with no args**

Run: `npm run lint`
Expected: completes and reports results rather than erroring on missing arguments. If it errors, change the `lint` script in `package.json` to `eslint .` and re-run.

- [ ] **Step 4: Verify every step passes locally**

Run each exactly as CI will:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key-for-build \
SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key-for-build \
npm run build
```
Expected: all five succeed.

- [ ] **Step 5: Confirm no test reaches the network**

Run: `npm test`
Expected: passes with `supabase stop` in effect and no network. `src/test/setup.ts` loads `.env.local` and defaults the Supabase URL, but every existing test mocks its client. If any test hangs or fails, it is reaching a real service and must be mocked before CI can be trusted.

- [ ] **Step 6: Commit and confirm green**

```bash
git add .github/workflows/ci.yml
# plus package-lock.json if Step 1 concluded the regenerated tree is good
git commit -m "Add CI: lint, typecheck, test, build

No workflow ran the configured eslint and vitest. Adds a GitHub Actions
gate on push to main and on pull requests, ahead of the repo going
public in tasks/ship/09.

Closes tasks/ship/05."
git push
```

Then confirm the workflow run is green in the GitHub Actions tab before considering Phase 0 complete.

- [ ] **Step 7: Update the ship checklist**

Set tasks 01–05 to `Done` in `tasks/ship/README.md`'s Phase 0 table and in each task file's `**Status:**` line.

```bash
git add tasks/ship
git commit -m "Mark Phase 0 tasks done"
```

---

## Self-Review

**Spec coverage.** Every Phase 0 row in the spec's checklist maps to a task: ship 01 → Task 1, ship 02 → Task 3, ship 03 → Task 2, ship 04 → Task 4, ship 05 → Task 5. Findings 1, 2, 5 and 8 from the spec are addressed here; findings 3, 4, 6, 7 belong to later phases and are correctly absent.

**Deviations from the spec, both deliberate and flagged inline:**
1. Audio URL TTL is 4 hours, not the spec's suggested 1 hour — reasoning in Task 3's header.
2. Ship task 03 lists `Depends on: 06` (the ElevenLabs purchase). Task 2 proceeds now because the *plan* is already decided (Starter, 25); only verification against the live account is deferred.

**Type consistency.** `ScriptReserveOutcome` is distinct from `audio/quota.ts`'s `ReserveOutcome` — the script version has no `invalid_retry`, matching its RPC, which raises only two exceptions. `uploadAudio` returns a path in Task 3 and its only caller is `generateAndUpload`, updated in the same step. `updateMeditationStatus`'s third parameter is renamed `audioPath` and both call sites (`finalize`, `markFailed`) are covered — `markFailed` passes only two arguments, so it is unaffected.

**Known gap.** `src/components/track-row.tsx:74`, `meditation-card.tsx:52` and `audio-section.tsx:27` read `meditation.audio_url` and continue to work unchanged, because Task 3 preserves that field name and populates it server-side. This is the reason for the keep-the-name approach and is intentional, not an oversight.
