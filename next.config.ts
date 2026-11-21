import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { withWorkflow } from "workflow/next";

// Generated meditation covers are public objects in Supabase Storage, shown
// through next/image so a 56px thumbnail is not served the 1024px original.
// Only the covers bucket is allowed, so the optimizer is no proxy for anything
// else. A local Supabase is on a loopback address, which Next refuses to
// fetch from unless told to; that is allowed only when the project URL is
// itself local, never for a deployed one.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseIsLocal =
  !!supabaseUrl && ["127.0.0.1", "localhost", "[::1]"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/meditation-covers/**",
            search: "",
          },
        ]
      : [],
    // A cover's path is random and never rewritten (a new cover is a new
    // object), so an optimized copy can be kept for a month.
    minimumCacheTTL: 31 * 24 * 60 * 60,
    dangerouslyAllowLocalIP: supabaseIsLocal,
  },
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
