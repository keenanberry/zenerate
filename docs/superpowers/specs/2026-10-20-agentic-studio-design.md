# Agentic Studio & Discover Design

**Date:** 2026-10-20
**Status:** Draft, for operator review
**Scope:** Replace the create wizard and the script editor with one chat, and rebuild
`/discover` around tags, categories and covers. Both gate opening signups.

---

## Why

The operator used the app live and found three problems:

- **The wizard form feels dated.** People expect to describe what they want in one line.
- **Hand-editing the script is the wrong tool.** Editing means learning the
  `*[PAUSE: N seconds]*` markup, and the planned form-based editor would only polish that
  textarea.
- **`/discover` doesn't feel like a place to find things.** It is a list of titles with
  free-text search. There are no categories, nothing popular, nothing with character.

What works and must survive: the script view, with its clearly separated sections,
pauses and sounds, while the script streams in. One flaw comes with it: the view stays
pinned at the top while the text runs off the bottom.

Zenerate is a hobby project, and the operator is its only user (signups are closed in
Supabase). **There is no launch date.** Signups open when this work is done.

## What it is

One conversation per meditation. You describe what you want in a single message, and the
agent writes the script, asking a short question first only when the request is too vague
to write from. You change the script by asking for changes. The audio is made from the
same conversation. A finished meditation links back to its chat, so after listening you
can return and say "add a section after the body scan."

The script is written into a **canvas** beside the chat, the way Claude builds an
artifact. The chat holds the conversation and small interactive cards. The canvas holds
the script, rendered with the existing section styling and following the text as it
streams.

---

## Decisions

Decisions marked *(operator)* were made by the operator. Those marked *(design call)*
were made in writing this document and are open to change during review.

### Conversation

| Decision | Choice |
|---|---|
| Entry point | `/create` is a single chat input. The wizard (`meditation-form.tsx`, `wizard-steps.tsx`) is removed. *(operator)* |
| Ask or write | The agent writes immediately when the request is clear and asks one short question when it isn't. No fixed questionnaire. *(operator)* |
| Editing | Only by conversation. `script-editor.tsx` and the hand-edit path are removed, and the post-ship form-based editor is dropped. *(operator)* |
| Agent scope | The agent only makes meditations. Its system prompt steers away from anything else: no coding help, no general chat, no essays. It declines in one friendly line and offers to make a meditation instead. *(operator)* |
| Chats are saved | Yes. One chat per meditation, and you can return to it any time. *(operator)* |
| Chats are private | Always, even on a public meditation. RLS has an owner-only policy on the chat tables and no `anon` grant. *(operator)* |
| Title, description, tags | The agent sets them as it writes. The owner can edit the title, description and tags inline on the meditation page; the script itself is never hand-edited. *(operator)* |
| Old meditations | Get no chat. The operator downloads what they want to keep and deletes everything in their account before the new schema goes in, so no backward compatibility is needed. *(operator)* |
| Layout | Two panes on desktop: chat on the left, canvas on the right. On a phone the canvas is a sheet you open from the chat, which shows a "Script updated" pill when the canvas changes. *(design call)* |
| Unfinished chats | A chat that has produced no script yet is a draft. It is listed under "Recent" on `/create`, not in the Library. *(design call)* |

### Rendering

| Decision | Choice |
|---|---|
| UI mechanism | AI SDK typed tool parts, rendered by our own components. json-render was evaluated and rejected: it is 0.x, built for the model to compose arbitrary layouts, and ours is a fixed set of cards. Revisit only if we want model-composed layouts. *(operator agreed)* |
| Script streaming | The agent writes the script through a `writeScript` tool. Anthropic's fine-grained tool streaming delivers the input in pieces, and the client renders `part.input.script` while the part is in `input-streaming`, so the canvas fills live. The canvas auto-scrolls with the stream until the reader scrolls up, the way chat apps do. *(design call)* |
| AI SDK version | Upgrade to AI SDK 7 (current `latest`; the repo is on 6.0.x) **before** any chat code is written. Nothing new should start on a superseded major. *(design call)* |
| Stream resumption | Not in v1. A reload rebuilds from the saved messages. Resumable streams need Redis. *(design call)* |

### Tools the agent has

The builder settles the exact shapes. These are the capabilities:

- **`writeScript`** writes the full script; revisions are full rewrites, not diffs. The
  server parses it with `parser.ts` and estimates its length with `duration.ts`, then
  returns both to the model as the tool result: segment counts, any markers the parser
  dropped, and the estimate against the requested duration. The model can then see and
  fix a script that is short or malformed. **Why:** the parser silently drops malformed
  markers, so a revision can lose content without any error.
- **`setDetails`** sets the title, a one-to-two sentence description, 2 to 5 tags from
  the fixed vocabulary, the type and the target duration. It is validated against the
  vocabulary.
- **Voice picker card:** the agent offers it when the script is settled, and you choose
  a voice inside the chat. It reuses `/api/voices` and the existing voice picker.
- **Make-audio card:** shows the voice, the length and how many renders you have left.
  **Audio only starts on your click; the agent can never spend a render on its own.**
  Then come a progress card (driven by the meditation's status, as
  `audio-processing-status.tsx` is today) and the player inline once the audio is ready.
- **Sound preview card:** the agent can show the sounds it is using, or suggest some,
  with a play button on each. Previews need browser-playable copies of the sound effects,
  which today exist only inside the sandbox snapshot. Exporting them is part of the task.

### Versions

| Decision | Choice |
|---|---|
| Model | One meditation, many versions. The meditation page has a version switcher. *(operator)* |
| When a version is created | Only when the script changes **after** the current version has audio. Revisions before any audio exists just overwrite the working script. *(design call)* |
| Replace or keep | When a revised version's audio finishes, the chat asks: replace the original (the old version and its audio file are deleted) or keep both (the switcher appears). Either way the new version becomes current. *(operator: replace-or-keep; design call: the moment it's asked)* |
| Public view | A public meditation shows its current version: script, audio, title, description, tags. *(design call)* |
| Expected use | Rare. Most people won't come back after the audio exists. Keep the switcher simple. *(operator)* |

### Limits

| Decision | Choice |
|---|---|
| Chat turns | Not metered against any user-facing quota. *(operator)* |
| Abuse ceiling | A high daily ceiling of messages per user (a starting value near 200, set by env), plus a step limit per turn, so a stolen session or a runaway loop can't run up the Anthropic bill. Normal use never reaches it. *(operator agreed)* |
| Script quota | The monthly script cap (`PER_USER_MONTHLY_SCRIPT_LIMIT`) and its reservation in `/api/generate` are retired along with that route, and issue #5 is closed as moot. *(design call)* |
| Audio quota | Unchanged at 3 renders a month, pinned to ElevenLabs Starter. A revised version's render counts. *(design call)* |
| Operator exemption | The operator's account is exempt from **both** the per-user and the global audio caps, through an env allowlist of user ids, and its renders don't count toward the global total that other users draw from. ElevenLabs' own credit balance is the backstop for those renders. *(operator)* |

### Public & Discover

| Decision | Choice |
|---|---|
| What goes public | Title, description, tags and labels, the script, the audio. Never the chat. *(operator)* |
| Tags | A fixed vocabulary in `src/lib/meditation/tags.ts`, as `tasks/post-ship/tags-and-filters.md` proposed: themes, practices, moments. The agent assigns them through `setDetails` instead of a separate classifier call. *(design call)* |
| `/discover` layout | Modeled on Spotify's Search tab. A search bar with filters (tag, type, duration) beside or inside it, category cards beneath it, then a **Popular** row and a **Picked for you** row. *(operator)* |
| Search | Postgres full-text search over title, description, tags and script. *(design call)* |
| Popular | Favorite counts plus plays by **signed-in** listeners (a lightweight play-event table; no plays are recorded today). Signed-out plays aren't counted, so there are no public writes. Until the counts mean something, Popular falls back to house picks so it never shows a row of one. *(operator agreed)* |
| Picked for you | Signed in: public meditations matching the tags of what you've favorited and made. Signed out, or with no history: house picks. *(design call)* |
| Covers | A designed cover system now, generated artwork later. Every meditation gets a cover derived deterministically from its tags and id, on brand and free. **`DESIGN.md`'s One Gradient Rule reserves gradients for the player**, so the cover needs a `DESIGN.md` amendment or a non-gradient treatment. The `zenerate-design` skill decides which. Generated art goes to post-ship and replaces the designed cover where one exists. *(operator leaning, agreed)* |

### Seeding & launch

| Decision | Choice |
|---|---|
| House meditations | The operator makes **24** through the new chat: about 8 categories × 3, so every category card opens onto a real list. They are public and published from the operator's account. *(operator)* |
| Credits | 24 × ~930 speech characters ≈ 22k credits, most of one month of Starter. The operator seeds them **through the new chat**, ideally on October's credits before the Nov 1 reset, otherwise on November's. *(operator)* |
| Backfill | Not planned: `setDetails` and the tag vocabulary ship in the first wave, so seeds are tagged as they're made. A backfill script is the fallback only if tagging slips. *(design call)* |
| Launch gate | Signups open when the studio, Discover and seeding are done, and when the open Phase 1–2 items (08, 10, 11) are closed. No fixed date. *(operator)* |
| Privacy page | `/privacy` is updated to say chats are stored, are private, and are deleted with the account. *(design call)* |

---

## Build order

The operator would like to seed through the chat on October's credits, but there is **no
real rush** *(operator)*: if Wave A isn't ready, seeding moves to November's credits. "It
doesn't have to be perfect, just most of it has to work" *(operator)*. Either way, the work
splits into two waves so seeding never waits on Discover.

**Wave A, the seedable studio.** The AI SDK 7 upgrade, the **final**
schema (chats, messages, versions, tags, description, plays; versions are in the schema
from day one even though their UI comes later, because seeded rows are never migrated),
the chat route with `writeScript` and `setDetails`, the canvas, the voice, make-audio,
progress and player cards, the operator exemption, the tag vocabulary, and removal of the
wizard and editor. The operator's data wipe happens before this schema goes to production.

**Wave B, around and after seeding.** Version creation and the switcher, "Continue in
chat", inline editing of the details, sound previews, `/discover` (search, filters,
categories, Popular, Picked for you), covers, play tracking and the privacy page.

Signups open after both waves and the remaining Phase 1–2 items.

## Goals

1. Describe a meditation in one message and get a script you can see forming, in under a minute.
2. Change anything about it by asking.
3. Make, hear and revise the audio without leaving the conversation.
4. A `/discover` you'd browse for fun, with categories, popular picks, covers and real search, filled with 24 good meditations before strangers arrive.

## Non-goals

- Generated cover artwork (post-ship).
- Agent memory across meditations. Its "Shape B" is no longer blocked once the loop exists, but it stays post-ship.
- Resumable streams, json-render, user profiles, moderation tooling.
- Migrating existing meditations into chats.

## Anti-goals: it fails even if it works when

- The agent will write a cover letter, debug code or chat about the news.
- Anything from a chat can be read by anyone other than its owner.
- An audio render happens without the owner pressing a button.
- A hand-editing path for the script creeps back in.
- A revision silently drops script content, or turns a 20-minute meditation into 8 minutes without saying so.
- `/discover` launches with empty categories or rows of one.

## Constraints

- **Sandbox snapshot.** If anything in the audio pipeline changes (`generate-audio.ts`
  and its imports, `scripts/sound-effects.ts`), the snapshot must be rebuilt and
  `AUDIO_SANDBOX_SNAPSHOT_ID` redeployed. Versions should change how audio is *keyed and
  stored*, not what runs in the sandbox. See the `audio-pipeline` skill.
- **`anon` needs grants.** Every new table read on a public page needs an `anon` table
  `GRANT` as well as an RLS policy. Locally `anon` can read everything, so only production
  catches a missing grant. Chat tables get neither.
- **Workflow package major.** Check `npm view workflow dist-tags` when touching the audio
  trigger.
- **`.npmrc` legacy-peer-deps.** The AI SDK 7 upgrade's lockfile must be generated with
  the project `.npmrc` in place, or CI resolves the tree differently.
- **Design.** Every visible change goes through the `zenerate-design` skill: dark first,
  then light, then phone width.
- **Never `supabase db reset` against production.** The operator's data wipe is a
  targeted delete of their own rows and storage objects, run by the operator.

## Left to the builder

- Table shapes for chats, messages (`parts jsonb`, as in the AI SDK persistence guide)
  and versions, and how the current version is pointed to.
- Exact tool schemas, card components and how the canvas parses partial input.
- The tag vocabulary's contents and its 8 Discover categories (recorded in `tags.ts`).
- The cover treatment, within `DESIGN.md`.
- Whether the version switcher sits in the player or the page header.
- The daily ceiling's exact value.
- Whether `claude-sonnet-5-5` (issue #19) replaces `claude-sonnet-5` as the chat model. Measure on real chats first.
