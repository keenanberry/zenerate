# Stale Audio Run Recovery

**Status:** Not started
**Priority:** Post-ship. Filed 2026-10-10 after the first production audio failure.
**Related:** `src/lib/audio/workflow.ts`, `src/lib/audio/start-run.ts`,
`src/app/api/audio/generate/route.ts`, [Error tracking](./error-tracking.md)

## Why it matters

A meditation stuck on `processing_audio` has no way out. The page shows the spinner for
ever, Generate is hidden because the status is wrong, and the `pending` event row keeps
counting against the user's monthly cap (`getQuotaUsage` counts `pending` and
`completed`). The operator fixes it by hand with a REST PATCH, which is what happened on
2026-10-10.

PR #42 closed the first way in: the Workflow backend refusing to start the run, so no
run existed and the workflow's own `catch → markFailed` could never fire. That path now
reverts the meditation and refunds the slot inside the request. What remains is every
way a run that did start can end without reaching `markFailed`:

- `markFailed` is itself a step. If its Supabase write keeps failing past the step retry
  budget, the workflow fails with the row still `processing_audio`.
- The operator cancels the run (`workflow` CLI), or the backend drops it (outage, a
  retired package major mid-run, a deleted deployment). `cancelled` runs do not execute
  the `catch`.
- The sandbox hangs to its 5-minute timeout three times (`generateAndUpload.maxRetries
  = 2`), the run fails, and `markFailed` races a backend that has already given up.

None of these has happened yet. All of them leave the same row behind.

## Direction: ask the run, not the clock

The run id is already in hand at `src/app/api/audio/generate/route.ts` (`run.runId`,
returned to the client and then forgotten) and `workflow/api` exports
`getRun(runId)`, whose `status` is `pending | running | completed | failed | cancelled`.
So the recovery can be exact instead of a timeout guess:

1. **Store `run_id` on `audio_generation_events`** (one nullable text column, set after
   `start` succeeds). It is also the handle the operator wants when reading
   `workflow inspect runs` next to a stuck row.
2. **A lazy check on the meditation page**, owner only, when
   `meditation.status === "processing_audio"`: read the latest event for the meditation;
   if it has a `run_id`, ask `getRun`; if the run is `failed` or `cancelled`, or the
   event is older than a ceiling (20 minutes covers three sandbox timeouts), call the
   same `markFailed` write the workflow uses: meditation `failed`, event `failed` with
   `completed_at`. Because the event is then the meditation's latest and `failed`,
   `isFreeRetryAvailable` offers the free retry on the same render. A `running` run is
   left alone, whatever its age.
3. **The same check behind the polling component.** `AudioProcessingStatus` polls
   `getMeditationStatus` every 3 seconds with no ceiling; have the server action it
   calls run the check too, so a viewer already waiting sees the failure without a
   reload.

Hobby crons run once a day (`vercel.json` has one, the Supabase keepalive), so a sweeper
cron would leave a user stuck for up to a day. The page is where the user is; put the
check there. A daily sweep can be added to the keepalive route later for rows nobody
revisits, using the same function.

## Scope sketch

- Migration: `alter table audio_generation_events add column run_id text`.
- `src/lib/audio/recover.ts`: `recoverStaleRun(meditationId, serviceClient)` returning
  what it did, unit-tested with a fake `getRun`.
- Route: write `run_id` after a successful start.
- Page and `getMeditationStatus`: call it for owner-visible `processing_audio` rows.
- Log one line per recovery with the meditation id, run id and run status, in the
  shape the route already uses.

## Decisions to make

- Reset to `failed` (free retry, matches the workflow's own path) or `script_ready`
  (matches the never-started revert). `failed` is the better default: a run that
  started may have spent ElevenLabs credits, and the free-retry ledger exists to make
  that case cheap for the user.
- Whether a `running` run older than the ceiling should ever be overridden. Default no;
  log it and let the operator cancel the run, which then trips the check.
