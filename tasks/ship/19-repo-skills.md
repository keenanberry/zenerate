# Repo Skills

**Status:** Not started
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

- [ ] Both skills created with valid frontmatter (`name`, `description`) following the `writing-for-agents` / `superpowers:writing-skills` conventions
- [ ] `description` fields written as triggers — the conditions under which the skill should fire, not a summary of contents
- [ ] `zenerate-design` fires on any UI, styling, component or theme work
- [ ] `audio-pipeline` fires on any edit under `src/lib/audio/` or to the sound assets
- [ ] Each skill states its rules concretely enough to be checkable, with the real `file:line` references from this codebase
- [ ] Neither skill restates what `CLAUDE.md` already covers
- [ ] Verified by starting a fresh session, asking for a small UI change, and confirming the design skill loads and is followed

## Implementation notes

- Invoke `superpowers:writing-skills` before authoring — there are conventions about frontmatter, trigger phrasing and length that are easy to get subtly wrong.
- Keep both short. A skill nobody finishes reading is a skill nobody follows. The design skill should fit on one screen; push detail into the token table rather than prose.
- Deliberately **not** creating skills for migrations or Supabase client selection — the `CLAUDE.md` conventions table already covers those, and a skill that duplicates `CLAUDE.md` is maintenance burden that will drift out of sync with it.

## Open questions

- Should the design skill be directory-scoped to `src/components/` and `src/app/`, or repo-wide? Repo-wide is simpler and the false-positive cost is one extra skill load. Default: repo-wide.
