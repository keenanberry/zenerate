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

## Operating as an individual — settled 2026-09-14

Zenerate is a personal project with no company behind it. That is a decision, not a
placeholder, and it changes three things:

- **"We" is a person.** Most Terms templates assume a company and will need rewording.
  Say plainly that the service is operated by an individual.
- **Liability disclaimers matter more, not less.** There is no corporate shield here, so
  the disclaimers and the "provided as is" language are doing real work. Do not trim them
  because the project is small.
- **Make the Terms assignable.** If this ever becomes an LLC, an assignment clause means
  the agreement transfers instead of every user needing to re-accept.

**One decision still needed before writing:** the privacy policy must publish a contact
**email address** for data requests. Using a personal or work inbox puts a private address
on a public page and ties the policy to one person's account — prefer a project address
like `privacy@zeneratestudio.com`, which needs the domain from task 09. That is the only
thing blocking this task.

**Note this is inbound mail, and separate from task 08.** Task 08 sets up Resend to *send*
signup confirmations and password resets (SPF + DKIM, both TXT records). Receiving mail at
`privacy@` needs MX records pointing at a mail host — Vercel manages DNS but does not host
mailboxes, including for domains registered through Vercel. Different record types, so they
coexist fine, but Resend does not give you an inbox. For a contact that will receive
approximately nothing, a free forwarder (ImprovMX, Forward Email) to a personal inbox is
sufficient; a real mailbox (Zoho free tier, Fastmail, Google Workspace) is only worth it if
you want to send *as* that address.

## Implementation notes
- For a v1 ship with low user count, a template-based policy (Termly, Iubenda free tier, or a hand-adapted open-source template) is fine. Avoid just copying another app's terms verbatim.
- Keep the pages as simple Next.js MDX or plain `.tsx` with rendered markdown — no need for a CMS.
- Include `last updated` date at top of each.
- If targeting EU users: GDPR adds requirements (DPO contact, right to deletion flow, etc.). Ship-scope: include the relevant language even if we don't yet have a deletion UI — task list it for post-ship.

## Open questions
- ~~LLC or personal project?~~ **Resolved 2026-09-14: personal project, no business entity.** Implications below.
- Cookie banner needed? Supabase uses local storage, not cookies, so probably just a disclosure in the policy suffices — verify.
