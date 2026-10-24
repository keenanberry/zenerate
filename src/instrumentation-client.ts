import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sentryOptions } from "@/lib/sentry/options";

// Browser error tracking. Errors only: no tracing, session replay or session tracking.
if (SENTRY_DSN) {
  Sentry.init(sentryOptions);

  // Attach the signed-in user's id (never the email) so errors group by who
  // was affected. INITIAL_SESSION fires straight away with the session from
  // the cookie, then every sign-in and sign-out follows.
  void import("@/lib/supabase/client").then(({ createClient }) => {
    createClient().auth.onAuthStateChange((_event, session) => {
      Sentry.setUser(session ? { id: session.user.id } : null);
    });
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
