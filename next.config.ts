import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Source maps upload to Sentry on builds that have SENTRY_AUTH_TOKEN (set in
// Vercel), then are deleted so they are never served. Without the token no
// source maps are generated at all, so a build can't publish them by accident.
export default withSentryConfig(withWorkflow(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.CI,
  telemetry: false,
});
