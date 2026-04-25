# Ship Checklist

Work required before deploying Zenerate to real users. Tasks are ordered — lower numbers block later ones or carry more risk.

| # | Task | Status | Notes |
|---|---|---|---|
| 01 | [Production Supabase project](./01-production-supabase.md) | Not started | Prereq for Vercel deploy |
| 02 | [Vercel deploy setup](./02-vercel-deploy.md) | Not started | Requires public repo |
| 03 | [Generation quota (3/month)](./03-generation-quota.md) | Done | ElevenLabs cost protection |
| 04 | [LLM duration constraints](./04-llm-duration-constraints.md) | Not started | Quality for long meditations |
| 05 | [Sound effects library](./05-sound-effects-library.md) | Not started | Requires snapshot rebuild |
| 06 | [Download button](./06-download-button.md) | Not started | Small lift |
| 07 | [Toast notifications (Sonner)](./07-toast-notifications.md) | Not started | Sonner already installed |
| 08 | [Password reset flow](./08-password-reset.md) | Not started | Supabase built-in, needs UI |
| 09 | [Terms / Privacy pages](./09-legal-pages.md) | Not started | Required for UGC |
| 10 | [Error / not-found boundaries](./10-error-boundaries.md) | Not started | Next.js conventions |
| 11 | [SEO metadata](./11-seo-metadata.md) | Not started | Landing + key pages |
| 12 | [Seed data prod guard](./12-seed-data-prod-guard.md) | Not started | Prevent test users in prod |

## How to use this folder

Grab the lowest-numbered `Not started` task. Read its file, update status to `In progress`, implement, update to `Done` and update the table above. Each task file includes acceptance criteria so you can verify before marking done.
