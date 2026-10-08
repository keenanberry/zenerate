# Agent User Memory

**Status:** Not started
**Priority:** Post-ship
**Related:** [Conversational script refinement](./conversational-script-refinement.md) — see *The coupling* below

## Why it matters

Every generation starts from zero. A user who always wants body-scan meditations with
long silences and no bells re-specifies that every single time, and the model has no way
to know their last five scripts were all edited the same way afterwards. The wizard
collects type, duration, focus and preferences per generation and then forgets all of it.

Remembering preferences across generations is the difference between a tool you configure
each time and one that gets to know you.

## The coupling worth understanding first

The instinct is "give the agent a memory tool." That presupposes something that does not
exist yet: **there is no agent loop.** `/api/generate` is a single `streamText` call with
no tools, which returns one script and ends. A memory *tool* only makes sense once the
model can decide to call it mid-conversation — and the thing that creates that loop is
[conversational script refinement](./conversational-script-refinement.md).

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
