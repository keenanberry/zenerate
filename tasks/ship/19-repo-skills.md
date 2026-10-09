# Repo Skills

**Status:** Done
**Priority:** Ship-blocker for Phase 3 — do this before 20–23
**Blocks:** 20, 21, 22, 23 (this is what keeps them consistent)

## Why this comes first in the phase

Phase 3 is four tasks that all touch the same visual system, likely across separate
sessions. Without the direction written down somewhere an agent reads *before* editing
UI, each session re-derives it and the result drifts.

Finding 6 in the design doc is the proof this happens: `--font-serif: "Lora"` is declared
three times in `globals.css` and the font is never loaded, so every `font-serif` usage
silently falls back to Georgia. That's exactly the class of mistake a skill catches.

## Skills to create

### `.claude/skills/zenerate-design/`

The design system as an enforceable contract, not a description.

- Palette tokens and which are load-bearing; the rule that raw Tailwind colours are never used in place of theme tokens
- The Lora/Geist split — Lora for meditation script text and headings, Geist for UI chrome — and the requirement that any font referenced in a token is actually loaded in `layout.tsx`
- Spacing scale and the loosened vertical rhythm the Nocturne pass establishes
- The gradient motif: where it appears (play button, played waveform), and that it renders as a flat tint in light mode rather than a glow
- **Dark-first review rule:** build and verify in dark, then check light. Never the reverse
- Anti-patterns this codebase has already hit: declaring a token without loading the asset, shadow-based elevation on dark surfaces, `max-w-5xl` everywhere regardless of content type

### `.claude/skills/audio-pipeline/`

The snapshot procedure, which `CLAUDE.md` names but does not operationalise.

- Which files are baked into the snapshot (`src/lib/audio/generate-audio.ts`, bundled sound assets)
- The full loop: edit → `npx tsx scripts/create-sandbox-snapshot.ts` → capture the printed ID → update `AUDIO_SANDBOX_SNAPSHOT_ID` in `.env.local` **and** Vercel → verify with `scripts/test-audio-generation.ts`
- Why it matters: the failure is **silent**. The edit lands, tests pass, nothing changes at runtime, and it presents as a code bug rather than a stale snapshot

## Acceptance criteria

- [x] Both skills created with valid frontmatter (`name`, `description`) following the `writing-for-agents` / `superpowers:writing-skills` conventions
- [x] `description` fields written as triggers — the conditions under which the skill should fire, not a summary of contents
- [x] `zenerate-design` fires on any UI, styling, component or theme work
- [x] `audio-pipeline` fires on any edit under `src/lib/audio/` or to the sound assets
- [x] Each skill states its rules concretely enough to be checkable, with the real `file:line` references from this codebase
- [x] Neither skill restates what `CLAUDE.md` already covers
- [x] Verified by starting a fresh session, asking for a small UI change, and confirming the design skill loads and is followed

## Implementation notes

- Invoke `superpowers:writing-skills` before authoring — there are conventions about frontmatter, trigger phrasing and length that are easy to get subtly wrong.
- Keep both short. A skill nobody finishes reading is a skill nobody follows. The design skill should fit on one screen; push detail into the token table rather than prose.
- Deliberately **not** creating skills for migrations or Supabase client selection — the `CLAUDE.md` conventions table already covers those, and a skill that duplicates `CLAUDE.md` is maintenance burden that will drift out of sync with it.

## Open questions

- Should the design skill be directory-scoped to `src/components/` and `src/app/`, or repo-wide? Repo-wide is simpler and the false-positive cost is one extra skill load. Default: repo-wide.

## Outcome (2026-10-09)

Both skills exist and were tested the way `superpowers:writing-skills` prescribes: a fresh
opus agent given the same small task with and without the skill present.

- **`zenerate-design`** (`.claude/skills/zenerate-design/SKILL.md`). Without it, the agent
  asked to restyle the script-viewer markers kept the file's raw amber/blue/purple palette
  classes, noticed Lora was unloaded and moved on, and verified one of the component's three
  usage sites. With it, the agent invoked the skill unprompted, read `DESIGN.md`, replaced
  the palette classes with `--marker-*` tokens added to both theme blocks and derived from
  the tertiary hues DESIGN.md names, found all three usage sites, flagged the font wiring as
  task 20's, ran the detector once, and planned verification in the skill's order (dark
  desktop, dark 390px, light both, every site). Browser access was blocked in that run and
  the agent reported the unverified steps instead of claiming them.
- **`audio-pipeline`** (`.claude/skills/audio-pipeline/SKILL.md`). Without it, the agent
  assembled the rebuild procedure correctly, but from the Phase 2 handoff, which the next
  handoff supersedes, and omitted retiring the old snapshot. With it, the agent invoked the
  skill, produced the full loop including cleanup, flagged the `CLAUDE.md` import list for
  update, and used 8 tool calls where the baseline used 19.

**Decisions**
- The design skill is the procedure, not the token table. Tokens, type scale, named rules
  and do's/don'ts live in `DESIGN.md` (Impeccable's DESIGN.md format), which the skill tells
  the agent to read first. One source of truth; the skill carries only what a table cannot:
  file:line evidence of where each rule is already broken, and the verification order.
- `PRODUCT.md` and the `.impeccable/design.json` sidecar were written alongside, from a
  four-question interview with the operator, so `/impeccable` resolves both records.
- `CLAUDE.md`'s snapshot section was trimmed to the gotcha plus a pointer to the skill, and
  gained a Design System pointer.
- Repo-wide, not directory-scoped, as the open question defaulted.

**Found along the way, recorded where it belongs**
- `--font-sans: Geist` is as broken as `--font-serif`: `next/font` registers faces under
  hashed family names, so the whole app renders in the system sans today. DESIGN.md's
  Loaded Face Rule and task 21's notes; task 20 fixes both.
- The rose is `--accent` in light but `--accent-foreground` in dark, so a `--primary` →
  `--accent` gradient is purple-to-purple in dark. Task 21's notes.
- The brainstorm mockup task 21 cited was gitignored scratch and no longer exists.
  `DESIGN.md` is the record; task 21 updated.
- Logo direction decided with the operator: a bodhi tree or bodhi leaf mark as SVG, Lora
  wordmark as fallback. Task 23 updated.

**Deviation:** the "fresh session" criterion was met with fresh subagents in this worktree
rather than a new terminal session. Skills are discovered from `.claude/skills/` either way,
and the GREEN agents' reports name the skill they invoked.
