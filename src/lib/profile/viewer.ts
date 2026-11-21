import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for this request, or null. Wrapped in React's `cache`,
 * so the `(app)` layout, a page and the reads it makes share one
 * `auth.getUser()` per server render rather than each asking Supabase Auth.
 * Server components only: outside a render, `cache` does not memoize.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface Viewer {
  user: User | null;
  /** user_profiles.display_name; null when unset, signed out, or unreadable. */
  displayName: string | null;
}

/**
 * The signed-in user and their display name, once per server render: the
 * layout's avatar and the Library header's both read it. A failed profile
 * read is logged and leaves displayName null, so the avatar falls back to the
 * email's letter (`initials`) rather than failing every page.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getSessionUser();
  if (!user) return { user: null, displayName: null };

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();
  if (error) console.error("Could not read the display name for the avatar:", error);
  return { user, displayName: profile?.display_name ?? null };
});
