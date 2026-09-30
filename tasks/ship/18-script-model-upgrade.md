# Script Model Upgrade

**Status:** Done, except the side-by-side (needs an Anthropic key)
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

- [x] Model id updated to `claude-sonnet-5`
- [ ] Same prompt generated on `claude-sonnet-4-6`, `claude-sonnet-5` and `claude-opus-5`, at 5 / 15 / 30 minutes, and compared side by side before settling
- [ ] Whichever model wins is recorded here with a one-line reason, so the next person doesn't re-run the comparison
- [x] `MEDITATION_SYSTEM_PROMPT` re-read. **Left as-is, deliberately.** Most of its length is the markup contract, which is load-bearing rather than over-prescriptive: `parser.ts` matches anchored regexes against the whole trimmed line, so the format rules are a hard interface, not style advice. The `Guidelines` block is genuinely stylistic and is the part to trim if Sonnet 5's output reads stiff — but that judgement needs the side-by-side below
- [x] `maxOutputTokens` set explicitly — **already done by task 01** (`8000`). This criterion was stale; nothing to change
- [x] Parser locked down with **17 characterization tests** (`parser.test.ts` — it previously had none). It cannot be verified against real Sonnet 5 output without an API key, so instead the parser's exact current behaviour is now pinned, including the silent-failure paths a formatting shift would trigger

## Resolved during implementation

**Thinking behaviour changes silently on this swap, so it is now set explicitly.** On
`claude-sonnet-4-6`, omitting the `thinking` parameter meant *no* thinking. On Sonnet 5,
the same omission runs **adaptive** thinking. This route streams into the create wizard,
and thinking blocks stream with empty text (`display` defaults to `"omitted"`), so the
swap alone would have made the user watch a blank panel while the model reasoned — and
billed those thinking tokens at output rates. The route now sets
`thinking: { type: "adaptive" }` with `effort: "low"`.

**No breaking parameters were in use.** Sonnet 5 rejects `temperature`/`top_p`/`top_k`
and assistant prefill with a 400. This route used none of them, so the swap needed no
other change.

**The parser had zero tests before this task.** That is the real risk in a model change:
`parser.ts` drops any line starting with `*[` that does not match a marker regex — it is
neither parsed as a marker nor kept as speech. A model emitting `*[PAUSE: 3 seconds]*
Welcome back.` on one line loses **both** the pause and the words "Welcome back", with no
error. The new tests pin that behaviour so it is a deliberate decision rather than a
surprise.

## Still needs an Anthropic API key

- [ ] **The 3 × 3 side-by-side** (`claude-sonnet-4-6` / `claude-sonnet-5` / `claude-opus-5`, at 5 / 15 / 30 minutes). Cannot be run without `ANTHROPIC_API_KEY`
- [ ] **Record which model wins, with a one-line reason**, so nobody re-runs the comparison

Sonnet 5 is a strict improvement over 4-6 on price *and* generation regardless of how the
comparison lands, so shipping the swap now is safe. The open question is only whether
Opus 5 is worth ~$0.68/month more at ~30 scripts/month.

## Implementation notes

- The model id strings are complete as written — do not append date suffixes.
- Coordinate with task 16 (duration constraints). Both change generation behaviour, and evaluating them independently is much easier than untangling two simultaneous changes. Do the model swap first, then tune the prompt against the new model.
- `@ai-sdk/anthropic` passes the model id straight through, so this is a one-line change plus verification.
- If quality differences are marginal, prefer Sonnet 5 — cheaper and faster, and the savings compound if usage grows.

## Open questions

- Is script quality currently a felt problem, or is it fine? Still open — nobody has generated a script in production yet, so there is no evidence either way. Revisit once the key is set and real scripts exist.
