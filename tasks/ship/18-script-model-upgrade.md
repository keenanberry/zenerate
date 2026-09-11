# Script Model Upgrade

**Status:** Not started
**Priority:** Nice to have — cheap, strictly beneficial, no reason to defer
**Depends on:** 01 (touch the route once, not twice)

## Why this is worth doing

`src/app/api/generate/route.ts:12` pins `claude-sonnet-4-6`. That's a previous-generation
model, and the current-generation Sonnet is both **newer and cheaper**:

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| `claude-sonnet-4-6` (current) | $3.00 | $15.00 |
| `claude-sonnet-5` | $2.00 | $10.00 |
| `claude-opus-5` | $5.00 | $25.00 |

A strict improvement in both dimensions — there is no argument for staying on 4-6.

At roughly 30 scripts/month the absolute spend is under a dollar either way, so this is
about output quality rather than cost. Worth auditioning Opus 5 too: meditation scripts
are short, so even Opus-tier pricing is negligible here, and script quality is the whole
product.

## Acceptance criteria

- [ ] Model id updated to `claude-sonnet-5`
- [ ] Same prompt generated on `claude-sonnet-4-6`, `claude-sonnet-5` and `claude-opus-5`, at 5 / 15 / 30 minutes, and compared side by side before settling
- [ ] Whichever model wins is recorded here with a one-line reason, so the next person doesn't re-run the comparison
- [ ] `MEDITATION_SYSTEM_PROMPT` re-read against the chosen model — prompts written for an older model are frequently over-prescriptive for a newer one and can actively reduce quality
- [ ] `maxOutputTokens` set explicitly (currently unbounded — see task 01)
- [ ] Generated scripts still parse cleanly through `src/lib/meditation/parser.ts`; the marker syntax is strict and a model change can shift formatting

## Implementation notes

- The model id strings are complete as written — do not append date suffixes.
- Coordinate with task 16 (duration constraints). Both change generation behaviour, and evaluating them independently is much easier than untangling two simultaneous changes. Do the model swap first, then tune the prompt against the new model.
- `@ai-sdk/anthropic` passes the model id straight through, so this is a one-line change plus verification.
- If quality differences are marginal, prefer Sonnet 5 — cheaper and faster, and the savings compound if usage grows.

## Open questions

- Is script quality currently a felt problem, or is it fine? If nobody has complained, the honest answer may be "swap to Sonnet 5 for the price cut and stop there". Worth deciding after the side-by-side rather than before.
