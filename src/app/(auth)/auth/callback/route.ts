import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_PATH, safeNextPath } from "@/lib/auth/redirect";
import { callbackErrorKind } from "@/lib/auth/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Next dev reports request.url as localhost even when the browser used 127.0.0.1, and
  // the session cookie is set on the host the browser used, so redirect back to that.
  url.host = request.headers.get("host") ?? url.host;
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // An expired or reused reset link lands on the reset page, which offers a new one.
  if (next === RESET_PASSWORD_PATH) {
    return NextResponse.redirect(`${origin}${RESET_PASSWORD_PATH}?error=expired`);
  }

  // A Google sign-in that failed or was cancelled goes back to /login with a sentence,
  // keeping `next` so a second try still lands where the first was headed.
  const login = new URL("/login", origin);
  const kind = callbackErrorKind(searchParams) ?? (code ? "link-failed" : null);
  if (kind) login.searchParams.set("error", kind);
  if (next !== "/dashboard") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
