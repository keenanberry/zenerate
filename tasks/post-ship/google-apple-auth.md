# Google / Apple Auth

**Status:** Not started. Scoped for a future session (refreshed 2026-10-22)
**Priority:** Post-ship. One of the three "next up" candidates in the README.

> **Does Supabase offer this?** Yes. Google and Apple are both built-in Supabase Auth
> providers, configured under Authentication → Sign In / Providers, and called from the app
> with `supabase.auth.signInWithOAuth({ provider: 'google' | 'apple' })`. The existing
> `/auth/callback` route already exchanges the code, and its `next` handling is same-origin
> only since ship 11.
>
> **Cost and effort, roughly:**
> - **Google:** free. A Google Cloud OAuth client and consent screen, the Supabase callback
>   URL added as an authorized redirect, and a button. About half a day, plus Google's
>   consent-screen review if you request more than the basic profile scopes.
> - **Apple:** needs an **Apple Developer Program membership ($99/year)**. That means an
>   App ID, a Services ID, a signing key and the domain verification file. The key and the
>   client secret need periodic rotation, so put a calendar reminder in the runbook. About a
>   day.
>
> **Things to check while building:**
> - **Linking with existing accounts.** Supabase links a social identity to an existing
>   account with the same verified email. Confirm that's the behavior you want for people who
>   signed up with a password first.
> - **Apple's "Hide my email"** gives a relay address, so the transactional email (Resend,
>   ship 08) must be able to send to `privaterelay.appleid.com`. That needs Apple's
>   email-relay registration of `noreply@zeneratestudio.com`.
> - **The installed iPhone app (ship 24).** An OAuth redirect from a home-screen web app can
>   open in Safari and land the session in Safari's storage rather than the app's. Test sign-in
>   from the installed app specifically.
> - **`/privacy`** must name Google and Apple as sign-in providers and say what they share.
> - Recommendation: **Google first.** It's free and covers most people. Add Apple when iPhone
>   users ask for it, or if a native app ever ships, since the App Store then requires it (or an
>   equivalent privacy-focused login) alongside other social logins.

## Why it matters
Email/password works but adds friction. Social providers speed up signup and reduce password-reset support load. Apple Sign-In is nice-to-have for iOS users when we eventually have a mobile PWA.

## Scope sketch
- Enable Google provider in Supabase (requires OAuth credentials from Google Cloud Console)
- Enable Apple provider in Supabase (requires Apple Developer account + Services ID config)
- "Continue with Google" / "Continue with Apple" buttons on `/login`
- Handle the case where a user previously signed up with email and now tries the social provider with the same email — Supabase has account-linking; decide the UX
- Update Terms/Privacy to disclose OAuth data flow

## Key decisions to make
- One-click vs dialog flow? Supabase's default redirect-based OAuth is fine but interrupts the session.
- Keep email/password available as fallback? (Almost certainly yes.)
- Do we collect a display name at social signup, or infer from the provider profile?

## Implementation notes
- Google OAuth credentials: Google Cloud Console → new project → OAuth consent screen → credentials. Add Supabase callback URL to authorized redirect URIs.
- Apple Sign-In: requires $99/yr Apple Developer account. Not worth it until there's clear user demand.
- Supabase docs: https://supabase.com/docs/guides/auth/social-login — check for Next.js 16 App Router specifics.
