import type { SupabaseClient } from "@supabase/supabase-js";
import { withCoverUrl } from "@/lib/cover/url";
import { toSearchArgs } from "@/lib/meditation/discover";
import type { Meditation } from "@/lib/meditation/types";

export type LandingMeditation = Pick<Meditation, "id" | "title" | "tags" | "settings" | "cover_url">;

const LANDING_COLUMNS = "id, title, tags, settings, cover_path";

/** How many meditations "Hear one first" shows. */
export const LANDING_ROW_SIZE = 3;

export type LandingRow = {
  /** Which list the row came from, so the page can say so. */
  source: "featured" | "newest";
  meditations: LandingMeditation[];
};

/**
 * The house picks when there are enough to fill the row, otherwise the newest
 * public meditations. A row of one or two picks would read as unfinished, and
 * mixing the two lists would hide which is which, so it is one or the other.
 * Null when there is nothing to show.
 */
export function pickLandingRow<T extends LandingMeditation>(
  featured: T[],
  newest: T[],
  size = LANDING_ROW_SIZE,
): { source: LandingRow["source"]; meditations: T[] } | null {
  if (featured.length >= size) return { source: "featured", meditations: featured.slice(0, size) };
  if (newest.length > 0) return { source: "newest", meditations: newest.slice(0, size) };
  return null;
}

/**
 * The row for "Hear one first", read at request time: ids differ between the
 * local seed and production, so the page never hardcodes one. Signed out this
 * reads as `anon`, which has SELECT on meditations behind the is_public RLS
 * policy (20261008000000) and EXECUTE on `discover_meditations`
 * (20261022000036). A failed read is not worth breaking the landing page
 * over: the failed list counts as empty, and with nothing to show the page
 * links to /discover instead.
 */
export async function getLandingRow(supabase: SupabaseClient): Promise<LandingRow | null> {
  const [featured, newest] = await Promise.all([
    supabase
      .from("meditations")
      .select(LANDING_COLUMNS)
      .eq("is_public", true)
      .eq("status", "completed")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(LANDING_ROW_SIZE),
    // Discover's own newest-first read, with no filters.
    supabase
      .rpc("discover_meditations", toSearchArgs({}, LANDING_ROW_SIZE))
      .select(LANDING_COLUMNS),
  ]);

  if (featured.error) {
    console.error("Landing: failed to read the house picks", featured.error.message);
  }
  if (newest.error) {
    console.error("Landing: failed to read the newest public meditations", newest.error.message);
  }
  const rows = (data: unknown) =>
    ((data ?? []) as (Omit<LandingMeditation, "cover_url"> & { cover_path: string | null })[]).map(
      ({ cover_path, ...m }) => withCoverUrl({ ...m, cover_path }),
    );
  return pickLandingRow(rows(featured.data), rows(newest.data));
}
