import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sentryOptions } from "@/lib/sentry/options";

/**
 * Error tracking for the Node and edge runtimes. `@sentry/nextjs` resolves to
 * the right SDK for each, so one init covers both. With no DSN this does
 * nothing, and onRequestError has no client to report to.
 */
export function register() {
  if (!SENTRY_DSN) return;
  Sentry.init(sentryOptions);
}

/** Errors thrown in server components, route handlers, server actions and proxy. */
export const onRequestError = Sentry.captureRequestError;
