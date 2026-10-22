# Agent User Memory

**Status:** Not started. Scoped for a future session (refreshed 2026-10-22)
**Priority:** Post-ship. One of the "next up" candidates in the post-ship README.
**Related:** `tasks/ship/29-chat-agent.md` (the agent loop this builds on). See *The coupling* below.

## Why it matters

Every generation starts from zero. A user who always wants body-scan meditations with
long silences and no bells re-specifies that every single time, and the model has no way
to know their last five scripts were all edited the same way afterwards. The wizard
collects type, duration, focus and preferences per generation and then forgets all of it.

Remembering preferences across generations is the difference between a tool you configure
each time and one that gets to know you.

> **Update 2026-10-20:** the agent loop now exists in the plan. Ship task 29 replaces the
> one-shot route with a persisted chat whose agent has tools, so Shape B is no longer
> blocked. The wizard is gone too, so "prefill the create wizard" below now means
> "inject into the chat agent's prompt." Both shapes stay post-ship: get the studio in
> front of real users first, then see what they repeat.

## The operator's ask (2026-10-22)

> "Saving user preferences and incorporating them in the chat context. That way the agent
> can say, *you want to go with Brittney again for a voice, or want to change it up?* Users
> might get bored picking the same stuff again and again."

Since the studio shipped, the repeated choices sit at the audio step: **voice and ambience**
on the Make audio card (ship 31 and 40), plus habits in the request itself (length,
practice, sounds). The design below starts there.

### A cheap first slice, with no new table

Most of this can be **derived** from what's already stored, before building any memory:
- Each meditation's `settings` already records the `voice`, the ambience (`music`) and
  `volume` it was rendered with, plus `duration` and `type`. "Last used" and "most used" are
  a query over the user's own completed meditations (RLS-bound client, owner only).
- **The audio card preselects** the last-used voice and bed, with a quiet "same as last time"
  hint. Picking something else is one tap, as today.
- **The agent gets a short, stable summary** in its context at the start of a chat. For
  example: "Recent choices: voice Brittney (4 of the last 5), ambience Rain (3 of 5),
  usually 10 minutes, often breathwork." The agent can then say "Brittney again, or
  something new?" when it offers the audio. A few words a turn is a negligible cost.
  - Put it in a **mid-conversation system message** after the first user message, not in
    the cached system prompt. Per-user text in the system prompt would break prompt caching
    for everyone (see the `claude-api` skill → prompt caching). Sonnet 5.5 supports
    mid-conversation system messages; check the AI SDK path for sending one.
  - Keep it append-only. Editing earlier turns breaks preserved thinking on Sonnet 5.5
    (task 47).
- **"Change it up":** the agent can suggest a voice or bed the person hasn't tried that fits
  the meditation. The catalogs are `src/lib/voices/` and `src/lib/meditation/ambience.ts`.

That slice is the 80% of the value, with no schema and no settings UI.

### Then: explicit preferences (Shape A below)

A `user_preferences` row (preferred voice, bed, default length, "no bells", free-text
always/never notes) with a small settings section on `/account`
(`tasks/post-ship/user-profiles.md`). Explicit settings override derived ones. Shape B, a
memory tool the agent writes to itself, still comes last, and only if real use shows
habits that derived and explicit preferences don't capture.

### Decisions to make

- Should the card **preselect** last time's choice, or only **suggest** it? Preselect is
  faster; suggest is more deliberate.
- How often should the agent mention preferences? The pick: once, when it offers the
  audio, never on every turn.
- Privacy: derived preferences come from the person's own data and are never shown to
  anyone else. If an explicit preferences table ships, add it to `/privacy` and to account
  deletion.

## The coupling worth understanding first

The instinct is "give the agent a memory tool." That presupposes something that does not
exist yet: **there is no agent loop.** `/api/generate` is a single `streamText` call with
no tools, which returns one script and ends. A memory *tool* only makes sense once the
model can decide to call it mid-conversation — and the thing that creates that loop is
conversational script refinement (now ship tasks 27–32).

So there are two shapes, and they cost very different amounts:

**Shape A — preferences row, no tool.** A `user_preferences` table, surfaced in settings
and injected into the system prompt at generation time. No agent loop, no tool use, works
with the current architecture as-is. Captures explicit preferences only: the user tells
you, or you infer from their settings.

**Shape B — memory tool inside an agent loop.** The model reads and writes memory itself,
so it can notice *"you've shortened the intro on your last three scripts"* without being
told. Strictly more capable, and strictly dependent on the chat work landing first.

Shape A delivers most of the value for a fraction of the work, and does not block Shape B
later — the same table can back both. **Do A first unless the chat feature is already
being built**, in which case do them together.

## Scope sketch (Shape A)

- `user_preferences` table: preferred voice, default duration, default type, speech
  density leaning, sounds on/off, free-text "always/never" notes
- RLS: own-row only, same pattern as every other table (and **remember the GRANT** — see
  `supabase/migrations/20261001000000_grant_table_privileges.sql`; policies alone are not
  enough)
- Settings UI to view and edit, so the memory is legible and correctable rather than
  mysterious
- Inject into `MEDITATION_SYSTEM_PROMPT` or the user prompt at generation time
- Prefill the create wizard from the stored defaults

## Key decisions to make

- **Explicit vs inferred.** Explicit preferences are predictable and easy to correct.
  Inferred ones ("you usually edit out the bells") are more magical and much more annoying
  when wrong. Start explicit.
- **Where it goes in the prompt.** Preferences in the *system* prompt are stable and cache
  well; in the *user* prompt they are per-request and easier to override. Given prompt
  caching, stable content belongs in the system prompt — but user-specific content in a
  shared system prompt fragments the cache per user. Measure before assuming.
- **Correctability.** Any memory a user cannot see and edit becomes a support burden the
  first time it is wrong.

## Implementation notes

- Duration and type defaults are the cheapest win and need no inference at all: the wizard
  already collects both, so remembering the last values used is a few lines.
- Keep script content out of preferences. Scripts are already stored; duplicating them into
  a memory store doubles the privacy surface for no gain.
- If Shape B happens, the memory tool belongs behind the same authorization discipline as
  everything else — reads and writes through an RLS-bound client, never service-role.
