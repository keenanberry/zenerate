# Google / Apple Auth

**Status:** Not started
**Priority:** Post-ship

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
