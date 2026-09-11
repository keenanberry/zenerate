# Landing Page Rewrite

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 20 (typography), 21 (Nocturne tokens)

## Why this blocks ship

The landing page is factually wrong. `src/app/page.tsx:15` advertises the audio pipeline
as **"(Coming soon)"** — it shipped in `f1e6a32` and `3d50021`. The single most impressive
thing the product does is described as unavailable.

Beyond the stale copy it's a standard four-feature icon grid: functional, and it reads as
a template. It's the first thing anyone sees, and after task 09 it's what
`zeneratestudio.com` resolves to.

## Acceptance criteria

**Correctness**
- [ ] "(Coming soon)" removed from the audio feature — it ships
- [ ] Every claim on the page verified against what the app actually does today
- [ ] Footer links to `/terms` and `/privacy` (task 15)

**Content**
- [ ] Hero leads with what makes this different from Calm or Headspace: you *make* the meditation, it isn't picked from a catalogue
- [ ] The generation flow is shown, not just described — the most compelling thing here is watching a script stream in
- [ ] One-line pitch locked and reused as the meta description in task 26 (that task lists it as an open question; resolve it here)
- [ ] Honest about the free-tier quota rather than letting a new user discover the 3/month cap after signing up

**Design**
- [ ] Built on the Nocturne tokens from task 21, with Lora headings from task 20
- [ ] Respects system theme — does not force dark (see task 21's open question)
- [ ] Real product surface visible above the fold, not just an icon grid
- [ ] Works at phone width; verified as an installed PWA start page

## Implementation notes

- The four features in `page.tsx:5-31` are reasonable content; the problem is presentation and one wrong word. This is a rewrite of the page, not a rethink of the pitch.
- An autoplaying muted loop of a script streaming in would carry the product better than any static screenshot. Keep it small, respect `prefers-reduced-motion`, and never let it block first paint.
- `/discover` is public and already populated — linking a real meditation from the landing page is more persuasive than a mockup.
- The header currently duplicates nav markup from `src/components/nav.tsx`. Worth reconciling while here, but don't let it grow the task.

## Open questions

- Does the landing page need social proof at launch? With zero users, no. Leave the space and revisit — a fake testimonial is worse than none.
