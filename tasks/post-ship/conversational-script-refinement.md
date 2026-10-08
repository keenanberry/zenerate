# Conversational Script Refinement

**Status:** Not started
**Priority:** Post-ship — the largest item in this folder
**Related:** [Agent user memory](./agent-user-memory.md), [Form-based script editor](./form-based-script-editor.md)

## Why it matters

Generation is one-shot. The user fills in the wizard, gets a script, and their only
options are accept it, hand-edit it, or regenerate from scratch and hope. There is no way
to say *"this is good but make the middle section longer and drop the bell at the end"* —
the thing anyone would say to a human writing this for them.

Regeneration is also expensive in a way that makes one-shot worse than it looks: each one
costs a monthly script generation, and per
[#5](https://github.com/keenanberry/zenerate/issues/5) a failed call burns a slot anyway.
So "just regenerate until it's right" is a quota-limited strategy, not a free one.

## What it changes architecturally

This is the big one, and it is worth being honest about the size.

Today `/api/generate` is a **single `streamText` call with no tools** that returns one
script and ends. There is no conversation state, no loop, no tool use. Chat means:

- **A conversation surface** — message history per meditation draft, stored somewhere, with
  its own table and RLS
- **An agent loop** — the model proposing edits to a script it can see, which means either
  passing the full script each turn or giving it tools to read and patch
- **Quota rethought.** The current model is one generation = one slot. A conversation is
  many model calls. Charging a slot per message makes chat unusable; charging per
  conversation needs a definition of when one ends. **This is the hardest part and it is a
  product decision, not a technical one.**
- **Streaming into an editable document**, which is a genuinely harder UI than streaming
  into a read-only view

It also unlocks the memory tool in [agent user memory](./agent-user-memory.md) — that task
is blocked on this loop existing, which is why the two are cross-referenced.

## Scope sketch

- `script_conversations` / `script_messages` tables, RLS own-row (**and grants** — see
  `20261001000000_grant_table_privileges.sql`)
- Chat panel beside the script, replacing or augmenting the current regenerate-or-edit pair
- Model holds the current script as context; edits return a full revised script at first,
  since diff-based patching is a second project
- Keep `src/lib/meditation/duration.ts` in the loop — after each revision, re-check the
  estimate against the requested duration so a conversational edit cannot silently turn a
  30-minute session into 12

## Key decisions to make

- **Quota model.** Per-message is unusable; per-conversation needs a boundary. Possibly a
  turn cap per draft (say 10 messages), which is legible and bounds cost.
- **Full rewrite vs targeted edit.** Full rewrites are far simpler and the scripts are
  small (~300-400 tokens), so the cost argument for diffing is weak. Start with rewrites.
- **Does this replace the wizard or sit after it?** The wizard is good at collecting
  structured constraints. Chat is good at refinement. Probably: wizard produces draft one,
  chat refines it.
- **What happens to the edit-by-hand path?** Two ways to change a script is one too many
  if they fight. The form-based editor task may be subsumed by this.

## Implementation notes

- `@ai-sdk/react`'s `useChat` is the counterpart to the `useCompletion` already in
  `meditation-form.tsx`, so the client side has a well-trodden path.
- The script format is strict — `parser.ts` matches anchored regexes and **silently drops**
  malformed markers. A conversational edit that reflows a line can therefore delete content
  without erroring. Re-parse and re-estimate after every revision; the parser tests added in
  task 18 document exactly which shapes vanish.
- Before building this, consider whether duration accuracy (`tasks/ship/16`) already solved
  the main reason people would want to iterate. Measure what users actually regenerate for
  before assuming chat is the fix.
