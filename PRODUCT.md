# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who already meditate and want a session on a specific concept or theme: a worry,
a transition, a practice they are working on. They do not want to write it themselves,
and they are tired of searching catalogue apps for a close-enough match. They arrive with
the theme in mind, usually on a phone, often at the edges of the day, and play the result
with eyes closed and the screen locked.

Also: the operator, who built it as a personal tool and uses it the same way; and
signed-out visitors who land on a shared meditation or `/discover`.

## Product Purpose

Turn a one-line description into a complete, listenable meditation: a script written for
that theme, narrated in a chosen voice, assembled with its pauses, silences and sound
effects into one audio file. Success is a meditation the user sits all the way through
and keeps.

## Positioning

The meditation is composed from your words, not picked from a library. Calm and Headspace
curate; Zenerate composes. A catalogue app cannot make that claim without becoming a
different product. The landing page leads with it (task 22).

One-line pitch, locked 2026-10-09: **"Meditations composed for you, not picked from a
catalogue."** It is the landing hero line (task 22), the text on the OG image (task 23)
and the default meta description (task 26). Change it in all three or in none.

## Operating Context

- A personal tool made public. One operator, hobby scale, about $8 a month to run, no
  revenue, no team. Decided and costed in
  `docs/superpowers/specs/2026-09-11-go-live-design.md`.
- The free tier is the product: a small monthly cap on audio generations per user and a
  global ceiling sized to the ElevenLabs Starter plan (values in `.env.example`). Users
  should learn the cap before signing up, not after.
- The flow: describe the meditation (type, length, focus, template optional) → the script
  streams in and can be edited → pick a narrator → generate audio, which takes 30–60
  seconds → listen, download, favourite, file into collections, optionally publish.
- Signed out, these work: the landing page, `/discover`, any public meditation, `/terms`,
  `/privacy`. Creating, downloading, collections and favourites need an email/password
  account.
- Playback is a waveform player on the meditation page. Lock-screen playback (task 25)
  and PWA install (task 24) are planned. Offline playback is not.
- Scripts come from Claude; narration from ElevenLabs, limited to the operator's
  "Zenerate" voice collection with Brittney as the default; audio is assembled by FFmpeg
  inside a Vercel Sandbox.

## Capabilities and Constraints

- Script markup the model writes and the app renders: `*[PAUSE: n seconds]*`,
  `*[SILENCE: n minutes]*`, `*[SOUND: file]*`. Six sound effects: two gongs, two bells, a
  chime, singing bowls. The script viewer shows these as structural markers between
  spoken passages.
- Meditation status: `generating_script → script_ready → processing_audio → completed |
  failed`. The UI switches on it.
- Narration is loudness-normalized; sound-effect levels were set by ear and are not to be
  re-levelled to a meter.
- Theme follows the system preference by default, with a toggle. Light and dark must both
  be correct everywhere.
- Single-operator operations: no admin dashboard, moderation, analytics or error
  tracking yet. All tracked in `tasks/post-ship/`.
- The landing page states the free tier before signup, reading both monthly caps from
  the same config the quota checks enforce (task 22). Social proof at launch: none, since
  there are no users yet; the space is left and revisited later.

## Brand Commitments

- Name: **Zenerate**, zen + generate. Rendered lowercase `zenerate` in the UI today.
- Domain: `zeneratestudio.com`. Pages read it from `NEXT_PUBLIC_SITE_URL`; the only
  hardcoded copy is that variable's fallback in `src/lib/seo/metadata.ts` (task 26).
- Logo: a lotus in line art, five petals over a base line with three dots above. Source
  `src/assets/brand/mark.svg`, component `src/components/brand-mark.tsx`; it sits beside
  the wordmark in the nav and above it on the login card, and every icon and the OG image
  are built from it. Chosen 2026-10-09 over the bodhi leaf, which read as a generic leaf.
- Copy voice: plain, honest, second person. "AI-generated" is stated, never hidden. No
  medical or outcome claims; the Terms say so.
- Visual direction: Nocturne, dark-first, with one gradient moment on the player.
  Decided 2026-09-11, recorded in `DESIGN.md`.

## Evidence on Hand

- A working product at `zeneratestudio.com`: generation, narration, assembly, public
  sharing all live.
- Example meditations and collections in `supabase/seed.sql`, local only.
- Legal pages at `/terms` and `/privacy`: operator named, Missouri law, minimum age 16.
- No testimonials, user counts, press, or case studies. Do not fabricate any.
- The mark, the icon set and a 1200×630 OG image carrying the pitch (task 23), wired into
  share metadata on every page (task 26).

## Product Principles

1. **Composed, not curated.** A feature earns its place by making the meditation more the
   user's own.
2. **Honest at hobby scale.** State the cap, the AI, the single operator. No fake proof.
3. **Built for eyes closed.** Audio that survives a locked screen outranks any on-screen
   feature.
4. **Reading is part of the practice.** The script is read before and after it is heard.
   It is a reading surface, not a form.
5. **One operator's cost line.** Anything that raises the monthly floor needs a reason.

## Accessibility & Inclusion

The product is used with eyes closed, so completing a session by audio alone is a
requirement. Player and forms must be keyboard-operable, `prefers-reduced-motion` must be
respected by every transition, and text in both themes must meet WCAG AA contrast.
