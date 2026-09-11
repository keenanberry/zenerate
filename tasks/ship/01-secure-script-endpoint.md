# Secure the Script Generation Endpoint

**Status:** Not started
**Priority:** Ship-blocker — highest severity item on this list
**Blocks:** 09 (do not make the repo public until this is done)

## Why this blocks ship

`src/app/api/generate/route.ts` is the entire handler:

```ts
export async function POST(req: Request) {
  const { prompt } = await req.json();
  const result = streamText({ model: anthropic("claude-sonnet-4-6"), system: MEDITATION_SYSTEM_PROMPT, prompt });
  return result.toTextStreamResponse();
}
```

No `getUser()`. No quota. No rate limit. It takes an arbitrary `prompt` and streams a
response billed to our Anthropic key.

Task 09 makes the repository **public**, publishing this endpoint's exact shape and path
alongside it. Anyone can then use `zeneratestudio.com/api/generate` as a free Claude
proxy. The generation-quota work in `0e7b15f` protected ElevenLabs only — Anthropic was
never covered, on the reasoning that script generation was "cheap enough not to worry
about". That reasoning holds for *our users*; it does not hold for an open endpoint on
the public internet.

Note the system prompt does not constrain the model to meditation content in a way that
survives a hostile `prompt` — so this is also a reputational exposure, not only a billing
one.

## Acceptance criteria

- [ ] Handler calls `supabase.auth.getUser()` and returns 401 for unauthenticated requests, matching the pattern already in `src/app/api/audio/generate/route.ts:11-19`
- [ ] Per-user monthly script-generation quota enforced, reusing the reservation pattern in `src/lib/audio/quota.ts` rather than inventing a second mechanism
- [ ] Quota limit exposed as `PER_USER_MONTHLY_SCRIPT_LIMIT` in `.env.example`, defaulting generously (scripts are ~$0.02 each — this is an abuse guard, not a product limit)
- [ ] Returns 429 with a clear message when the cap is hit
- [ ] Input validation: `prompt` must be a string and under a sane length cap; reject anything else with 400
- [ ] The create wizard surfaces the 401 and 429 cases rather than failing silently mid-stream
- [ ] Test covering: unauthenticated → 401, over-quota → 429, oversized prompt → 400
- [ ] Re-audited immediately before flipping repo visibility in task 09

## Implementation notes

- The audio route is the reference implementation for the auth half — copy its shape so both endpoints fail the same way.
- Script generation and audio generation should stay on **separate** counters. They have different costs and different abuse profiles; one shared limit would make the audio cap meaningless.
- Streaming complicates error responses: return 401/429/400 *before* calling `streamText`, so the client gets a normal JSON error rather than a truncated stream.
- Consider also capping `maxOutputTokens` on the `streamText` call — currently unbounded, so a crafted prompt could produce a very expensive single response.
- A global circuit breaker for Anthropic spend, mirroring `MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH`, is worth adding at the same time. Same table, same code path.

## Open questions

- Should unauthenticated users be able to preview generation at all (a "try it" flow on the landing page)? If yes, that needs its own IP-based rate limit and a much smaller cap — treat as a separate post-ship task, not a reason to leave this open.
