# Terms of Service + Privacy Policy

**Status:** Not started
**Priority:** Ship-blocker

## Why this blocks ship
The app accepts user-generated content (meditation scripts, potentially public on `/discover`), stores personal data (email, hashed password via Supabase), and uses third-party AI services that process user inputs. Running this without Terms and a Privacy Policy is a legal and compliance risk, and required for payment processing later (Stripe will ask).

## Acceptance criteria
- [ ] `/terms` page with Terms of Service
- [ ] `/privacy` page with Privacy Policy
- [ ] Both linked from the login/signup page (checkbox or footer text: "By continuing you agree to the Terms and Privacy Policy")
- [ ] Both linked from an app-wide footer, or at minimum the marketing landing page
- [ ] Privacy policy covers: email collection, Supabase as data processor, Anthropic + ElevenLabs as AI subprocessors that receive user content, storage of generated audio, cookies/session storage, data retention/deletion policy, contact email for requests
- [ ] Terms cover: acceptable use (no violent/illegal content in scripts), ownership (user owns their generated meditations), service availability disclaimers, AI-generated content disclaimers, termination policy

## Implementation notes
- For a v1 ship with low user count, a template-based policy (Termly, Iubenda free tier, or a hand-adapted open-source template) is fine. Avoid just copying another app's terms verbatim.
- Keep the pages as simple Next.js MDX or plain `.tsx` with rendered markdown — no need for a CMS.
- Include `last updated` date at top of each.
- If targeting EU users: GDPR adds requirements (DPO contact, right to deletion flow, etc.). Ship-scope: include the relevant language even if we don't yet have a deletion UI — task list it for post-ship.

## Open questions
- Are we registering as an LLC / business entity, or is this a personal project? (Affects who "we" is in the terms.)
- Cookie banner needed? Supabase uses local storage, not cookies, so probably just a disclosure in the policy suffices — verify.
