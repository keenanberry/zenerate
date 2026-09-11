# Transactional Email

**Status:** Not started
**Priority:** Ship-blocker
**Depends on:** 07 (production Supabase project), 09 (domain, for DNS records)
**Blocks:** 11 (password reset is unusable without working email)

## Why this blocks ship

Supabase's built-in email sender is rate-limited to a handful of messages per hour and is
explicitly not intended for production. Two flows depend on it:

- **Signup confirmation** — a new user who never receives the email cannot activate their account
- **Password reset** — task 11, which is itself a ship-blocker

`tasks/ship/07` previously said "SMTP configured (or Supabase default)". The parenthetical
was the trap: the default will appear to work in testing with two or three signups and
then quietly throttle.

## Acceptance criteria

- [ ] Transactional email provider chosen and account created (Resend is the default recommendation — generous free tier, good Supabase integration, simple DNS setup)
- [ ] Custom SMTP configured in the production Supabase project's auth settings
- [ ] Sending domain verified: SPF, DKIM and DMARC records added to `zeneratestudio.com`
- [ ] From-address set to something durable (`noreply@zeneratestudio.com`), not a personal inbox
- [ ] Supabase auth email templates customised — the defaults say "Supabase" and look like phishing
- [ ] Templates use `NEXT_PUBLIC_SITE_URL` so links point at production, not localhost
- [ ] Deliverability verified end-to-end: sign up with a Gmail address and a non-Gmail address, confirm both land in the inbox and not spam
- [ ] Password reset email verified the same way once task 11 lands
- [ ] Provider's sending limits noted here, and comfortably above expected signup volume

## Implementation notes

- Resend's free tier is 3,000 emails/month and 100/day at time of writing — verify current limits rather than trusting this line.
- Local development keeps using Supabase's Inbucket at `http://127.0.0.1:54324`; this task only changes the production project. Don't wire a real provider into local dev.
- DMARC can start at `p=none` for monitoring and tighten later. SPF and DKIM are the ones that actually affect inbox placement on day one.
- Check the spam score with a tool like mail-tester before considering this done — a technically-working setup that lands in spam is not working.

## Open questions

- Do we want a branded HTML template, or is plain text sufficient for v1? Plain text often has *better* deliverability and takes ten minutes. Default: plain text with correct links, revisit later.
