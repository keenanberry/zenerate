import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * The Sentry project's DSN. Unset, nothing is initialized and every Sentry
 * call in the app is a no-op, so the code can ship before the account exists.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Init options shared by the browser, Node and edge SDKs.
 *
 * Errors only: no tracing, no session replay, and no release-health
 * sessions, which would otherwise report every page load. Every category of
 * data the SDK collects by default is switched off, because what people type here
 * (chat messages, scripts, search terms) is personal and /privacy promises
 * error reports leave it out. The user is attached by hand, as an id only
 * (see `src/lib/supabase/server.ts` and `src/instrumentation-client.ts`).
 * `scrubEvent` then removes the same things again, in case an integration
 * slips something past these switches.
 */
export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  },
  integrations: withoutSessionTracking,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};

const SESSION_INTEGRATIONS = new Set(["BrowserSession", "ProcessSession"]);

/** Default integrations minus the ones that report sessions rather than errors. */
export function withoutSessionTracking<T extends { name: string }>(defaults: T[]): T[] {
  return defaults.filter((integration) => !SESSION_INTEGRATIONS.has(integration.name));
}

/**
 * Reduce an event to what triage needs: the request's method and path (no
 * query, body, cookies or headers beyond the browser's user agent) and the
 * user's id alone.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"] ?? event.request.headers?.["User-Agent"];
    event.request = {
      method: event.request.method,
      url: event.request.url && stripQuery(event.request.url),
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    };
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

/** Strip query strings from the URLs fetch, xhr and navigation breadcrumbs carry. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const key of ["url", "from", "to"]) {
    if (typeof data[key] === "string") data[key] = stripQuery(data[key]);
  }
  return { ...breadcrumb, data };
}

function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, "");
}
