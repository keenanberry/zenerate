import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component where cookies can't be set.
            // This can be ignored if middleware is refreshing sessions.
          }
        },
      },
    }
  );

  // Error reports carry the signed-in user's id (never the email) so they
  // group by who was affected. Server code reads the user through this
  // client, so wrapping getUser tags every request that looks. Sentry scopes
  // the user to the current request.
  const getUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = async (jwt?: string) => {
    const result = await getUser(jwt);
    Sentry.setUser(result.data.user ? { id: result.data.user.id } : null);
    return result;
  };
  return supabase;
}
