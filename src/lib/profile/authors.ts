import type { SupabaseClient } from "@supabase/supabase-js";

/** Who made a public meditation, when they have a public profile. */
export interface MeditationAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** meditation_authors looks at no more ids than this per call. */
export const MAX_AUTHOR_LOOKUP = 100;

/**
 * The public authors of the given meditations, keyed by meditation id, in
 * one call to meditation_authors. A meditation is missing from the map when
 * it is not public or its author has not made their profile public: show no
 * author line for it. Works on any client, signed out included.
 */
export async function getMeditationAuthors(
  supabase: Pick<SupabaseClient, "rpc">,
  meditationIds: string[],
): Promise<Map<string, MeditationAuthor>> {
  const authors = new Map<string, MeditationAuthor>();
  const ids = [...new Set(meditationIds)];

  for (let i = 0; i < ids.length; i += MAX_AUTHOR_LOOKUP) {
    const { data, error } = await supabase.rpc("meditation_authors", {
      p_meditation_ids: ids.slice(i, i + MAX_AUTHOR_LOOKUP),
    });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      meditation_id: string;
      author_id: string;
      display_name: string | null;
      avatar_url: string | null;
    }[]) {
      authors.set(row.meditation_id, {
        id: row.author_id,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      });
    }
  }
  return authors;
}
