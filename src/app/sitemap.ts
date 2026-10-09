import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl, sitemapEntries } from "@/lib/seo/metadata";

// Rebuilt at most hourly. Unlike /meditation/[id], nothing here is per-viewer:
// it reads as `anon`, without cookies, so caching it is safe.
export const revalidate = 3600;

/**
 * The landing, /discover, the legal pages and every public, finished
 * meditation. A failed read (the CI build has no database) lists the static
 * pages alone rather than failing the build or the route.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(siteUrl, await publicMeditations());
}

async function publicMeditations() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from("meditations")
      .select("id, updated_at")
      .eq("is_public", true)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("Sitemap: failed to read public meditations", error);
    return [];
  }
}
