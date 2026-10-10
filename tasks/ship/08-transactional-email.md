# Transactional Email

**Status:** Done* — *the production paste of the two templates and the inbox-placement check are the operator's; the reset email's end-to-end check waits on task 11
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

- [x] Transactional email provider chosen and account created (Resend, operator, 2026-10-10)
- [x] Custom SMTP configured in the production Supabase project's auth settings (through Resend's Supabase integration, which created the API key and wrote the SMTP settings itself; the key lives only there, 2026-10-10)
- [x] Email provider added to the service-provider list on `/privacy` (`src/app/(legal)/privacy/page.tsx`): it receives every user's email address
- [x] Sending domain verified: SPF, DKIM and DMARC records added to `zeneratestudio.com` (Resend's SPF and return-path MX sit on the `send` subdomain, so the apex MX stays free for task 15's forwarder; operator, 2026-10-10)
- [x] From-address set to something durable (`noreply@zeneratestudio.com`), not a personal inbox; sender name "Zenerate"
- [x] Supabase auth email templates customised: sources in `supabase/templates/` (confirmation and recovery), wired into the local config, guarded by `scripts/auth-email-templates.test.ts`. **Operator: paste each file's contents and subject into Authentication → Emails in the production dashboard; the dashboard is the only way in.** The original finding, **confirmed in production 2026-09-30** — the default confirmation email arrives from `noreply@mail.app.supabase.io`, is titled only "Confirm your email address", never names Zenerate or `zeneratestudio.com` anywhere, and carries a "powered by Supabase" footer with an "Opt out of these emails" link. A recipient has no way to tell what they signed up for, which is both a conversion problem and a phishing-report risk. Needs: sender name and address on the domain, the product name in the subject and body, a line saying what Zenerate is, and the footer gone
- [x] Templates point at production, not localhost: they use Supabase's own `{{ .SiteURL }}`, which is the project's Site URL setting (verified `www` in task 07), and `{{ .ConfirmationURL }}` for the action link. `NEXT_PUBLIC_SITE_URL` is a Vercel variable and never reaches the mailer
- [ ] Deliverability verified end-to-end: sign up with a Gmail address and a non-Gmail address, confirm both land in the inbox and not spam
- [ ] Password reset email verified the same way once task 11 lands
- [x] Provider's sending limits noted here, and comfortably above expected signup volume: free plan is 3,000 emails a month and 100 a day, one verified domain; sending pauses at the cap rather than billing (checked 2026-10-10)

## Implementation notes

- Resend's free tier is 3,000 emails/month and 100/day at time of writing — verify current limits rather than trusting this line.
- Local development keeps using Supabase's Inbucket at `http://127.0.0.1:54324`; this task only changes the production project. Don't wire a real provider into local dev.
- DMARC can start at `p=none` for monitoring and tighten later. SPF and DKIM are the ones that actually affect inbox placement on day one.
- Check the spam score with a tool like mail-tester before considering this done — a technically-working setup that lands in spam is not working.

## Not covered by this task

This task is **outbound only** — Resend sending on behalf of the app. It does not create a
mailbox, so nothing here lets you *receive* mail at the domain. Task 15's privacy-policy
contact address is a separate setup (MX records, a forwarder or mail host). Vercel does not
host mailboxes even for domains registered through it.

## Open questions

- Do we want a branded HTML template, or is plain text sufficient for v1? Plain text often has *better* deliverability and takes ten minutes. Default: plain text with correct links, revisit later.

## Outcome (2026-10-10)

- Resend connected through its Supabase integration rather than by hand: it created the
  API key and wrote host, port, username and sender into the production project. Nothing
  was added to Vercel or the repo; the app never sends mail itself.
- Templates are HTML on the light theme's tokens as hex (email clients cannot read the
  app's CSS variables): wordmark, serif heading, one paragraph, a button, the raw link for
  clients that strip buttons, a "didn't ask for this" line, and a footer that says what
  Zenerate is and why the address received the mail. No images, so nothing is blocked.
- Verified locally through a real send: `POST /auth/v1/recover` for a seed user produced
  the recovery mail in Mailpit with the new subject, no unfilled variables, and links to
  the local site URL and verify endpoint. Local config has `enable_confirmations = false`,
  so the confirmation template was not sent locally; it shares the same shell and
  variables, and the production signup check below is its real test.
- The reset email's subject and body are the "Reset password" template; task 11 supplies
  the page the link lands on.
