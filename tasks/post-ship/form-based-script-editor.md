# Form-Based Script Editor

**Status:** Not started
**Priority:** Post-ship

## Why it matters
Current script editing is raw text — users have to understand the `*[PAUSE: N seconds]*` markup to tweak their meditation. A structured editor lowers the barrier: users see segments as discrete blocks they can add, remove, reorder, and configure via form inputs.

## Scope sketch
- **Segment list view** — render the parsed script as a list of segment cards (speech, pause, silence, sound)
- **Per-segment controls** — edit speech text inline; adjust pause/silence duration with a slider; pick a sound from a dropdown backed by the sound effects library
- **Add/remove/reorder segments** — trash button, drag-handle, "insert below" affordance
- **Two-way sync with raw markup** — power users can still toggle to raw text view; parser + serializer keep them in sync
- **Preview updates** — the rendered preview pane re-parses as the user edits

## Key decisions to make
- Is the raw text still the source of truth, or do we move to a structured JSON representation in the DB? (Raw text is simpler and lets the LLM remain the source — keep it.)
- Conversational regeneration UX (per `docs/ui-roadmap.md`) should layer on top of this editor — plan for it in the component API.

## Implementation notes
- Existing `src/components/script-editor.tsx` is the place to evolve, not replace.
- Reuse `src/lib/meditation/parser.ts` for parsing; write a matching serializer that produces valid markup from the segment array.
- Drag-reorder: `@dnd-kit/core` is the modern choice; bundle size is reasonable.
- Keep the raw-text tab available — some users will prefer it, and it's a safety valve if the structured editor has a bug.
