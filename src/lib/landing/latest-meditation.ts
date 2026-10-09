import type { SupabaseClient } from "@supabase/supabase-js";
import type { Meditation } from "@/lib/meditation/types";

export type LatestMeditation = Pick<
  Meditation,
  "id" | "title" | "prompt" | "script" | "settings"
>;

/**
 * The newest public, finished meditation, read at request time: ids differ
 * between the local seed and production, so the landing page never hardcodes
 * one. Signed out this reads as `anon`, which the RLS policy and grant from
 * task 18b allow. A failed read is not worth breaking the landing page over,
 * so it returns null and the page links to /discover instead.
 */
export async function getLatestPublicMeditation(
  supabase: SupabaseClient,
): Promise<LatestMeditation | null> {
  const { data, error } = await supabase
    .from("meditations")
    .select("id, title, prompt, script, settings")
    .eq("is_public", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Landing: failed to read the latest public meditation", error.message);
    return null;
  }
  return data;
}
