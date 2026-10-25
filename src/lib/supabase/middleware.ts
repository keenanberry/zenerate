import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";

/**
 * Runs on every matched request (see `src/proxy.ts`): refreshes an expiring session so
 * server components and route handlers read a current one, and sends a signed-in visitor
 * away from /login. It gates nothing else; `(app)/(authed)/layout.tsx` is the auth gate.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims refreshes an expired session like getUser does, but verifies the JWT
  // locally against the project's signing keys instead of calling Supabase Auth on
  // every request. Pages that need the user still call getUser themselves.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  // GET only: a server action posted from /login must reach its handler.
  if (request.method === "GET" && request.nextUrl.pathname === "/login" && signedIn) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/dashboard");
    const url = new URL(next, request.nextUrl);
    // Next reports 127.0.0.1 as localhost, where the session cookie isn't set, so redirect
    // to the host the browser used (as the auth callback does).
    url.host = request.headers.get("host") ?? url.host;
    const redirect = NextResponse.redirect(url);
    // Carry a refreshed session over, or the browser keeps the used refresh token.
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}
