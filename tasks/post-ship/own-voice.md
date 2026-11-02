# Your Own Voice

**Status:** Not started. Filed 2026-11-02 from the operator's idea: "record and upload your
voice so you can use your own voice in the meditations".
**Priority:** Post-ship, and the feature that gives a paid tier its reason (`paid-tier.md`).
Nothing at launch depends on it; wait for the first month of usage numbers.
**Related:** `src/lib/voices/catalog.ts` and `server.ts` (the picker is the "Zenerate"
collection in the operator's ElevenLabs account, and `resolveVoiceId` rejects any other
voice), `src/app/api/voices/route.ts`, `src/components/audio-choices.tsx` (the voice row the
audio card and the meditation page share), `src/app/api/audio/generate/route.ts` (validates
the voice), `src/lib/audio/generate-audio.ts` (narrates with whatever voice id it is given;
baked into the snapshot), `src/lib/audio/signed-url.ts` and `storage.ts` (the pattern for a
private bucket), `tasks/post-ship/paid-tier.md`, `tasks/post-ship/user-profiles.md`
(`/account`, where the voice would live).

## Why

A meditation in your own voice is something no library app offers: your voice guiding you,
a parent's voice for a child, a teacher's for their students. It is personal in a way "more
renders" never is, so it is the natural reason for a higher paid tier rather than a feature
of the free one.

## How it would work

1. **Record in the app, two minutes.** ElevenLabs Instant Voice Cloning wants 1–2 minutes of
   clean speech (more than 3 can make the clone worse), as MP3 at 192 kbps or better. The
   browser's MediaRecorder gives WebM/Opus in Chrome and MP4/AAC in Safari; convert to MP3
   server side (the sandbox has FFmpeg) or send what ElevenLabs accepts. The session shows a
   short passage to read, meditation-toned, so the clone learns the right register.
2. **The first sentence is the consent record.** "I am [name], and I consent to Zenerate
   using a copy of my voice. Today is [date]." Read aloud, kept with the recording. See
   "Consent" below.
3. **One ElevenLabs call creates the clone** (`POST /v1/voices/add` with the samples;
   ElevenLabs makes the account affirm it has the rights). Store the returned voice id on the
   account, not on the meditation.
4. **"Your voice" in the picker.** The catalog stays the collection; the user's own voice is
   added for them alone. `resolveVoiceId`'s allowed set becomes the collection plus the
   requester's clone, so nobody can narrate with someone else's voice id.
5. **Rendering changes nothing.** `generate-audio.ts` already narrates with the voice id it
   is given, so no snapshot rebuild.

## The constraint: voice slots, not credits

Every clone lives in Zenerate's one ElevenLabs account, and the plan caps custom voices:
about 10 on Starter and about 30 on Creator (sources disagree on the exact numbers; the
subscription page is the one to trust). Cloning itself costs no credits, and narration costs
the same per character as any voice. So "every subscriber gets a voice" does not scale on a
small plan. Two ways out, to decide against the plan at the time:

- **Clone on demand.** Keep the recording in a private bucket; when a render starts, create
  the clone, narrate, delete the clone. Slots become a concurrency limit instead of a user
  limit, and the workflow already runs as steps. To test first: whether a voice re-cloned
  from the same samples sounds the same from one meditation to the next.
- **Seats.** A fixed number of voice seats on the higher tier, sold while they last. Simpler,
  and it reads as exclusive rather than limited.

## Consent

Anyone can hold a phone up to someone else's voice. The mitigations that fit the product:

- **Live recording only, never a file upload.** The consent sentence with name and date is
  part of the same take, so the recording is its own consent record. ElevenLabs requires the
  account to affirm rights and consent at clone time; keeping the take makes that
  affirmation verifiable, which matters as impersonation laws tighten.
- **Own meditations only, at first.** A cloned voice narrates the owner's meditations;
  publishing one with a cloned voice stays off until there is a moderation path
  (`public-content-moderation.md`). Lifting that later is a product decision, not a
  technical one.
- **Delete means delete.** Removing the voice deletes the ElevenLabs clone and the recording,
  and nothing else; audio already rendered stays, as it does for any voice. Account deletion
  (`account-deletion.md`) does the same.
- `/terms` and `/privacy` gain the voice recording, where it is stored, and the processor.

## Pricing

The feature that makes a second tier make sense: Plus at about $5 for more renders, and a
voice tier at $10–12 that includes this. The marginal cost is the plan step for slots and a
few megabytes of storage per user. Decide it with the paid-tier numbers after the first
month.

## Scope sketch

1. **Try it by hand first.** Clone the operator's voice in the ElevenLabs dashboard and
   render a house meditation with it through the existing pipeline (any voice id works in
   `generate-audio.ts` once the allowed set admits it). Stop here if the result is not
   something you would listen to.
2. A `voice_clones` table (user id, ElevenLabs voice id, sample path, consent name and
   date, created at) with owner-only RLS and grants in the task-58 style, and a private
   `voice-samples` bucket read through the `signed-url.ts` pattern.
3. The recording page under `/account`: the passage, the consent line, a level meter,
   re-take, then "Create my voice". A server action converts, uploads, calls ElevenLabs and
   stores the id.
4. The picker and `resolveVoiceId`: the collection plus the requester's own clone.
5. Plan gating: the tier column from `paid-tier.md` decides who sees the recording page.
6. The delete flow, and the terms and privacy copy.
7. If clone on demand: the create and delete steps around narration in `workflow.ts`, the
   delete in a `finally`, and a sweep for orphaned clones.

## Decisions to make

- Clone on demand or seats (above). Depends on the ElevenLabs plan when this is built.
- Professional Voice Cloning (Creator and above, 30+ minutes of audio, a dedicated model) as
  a later upgrade for people who want the closest match. Not for the first version.
- Whether a cloned voice may ever narrate a public meditation.
- The reading passage: who writes it, how long, and whether to offer a few in different
  registers.

## Not in scope

Voice design from a description, sharing a voice between accounts, and anything that clones
a voice from an uploaded file.
