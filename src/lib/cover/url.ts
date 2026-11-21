/**
 * Where a generated cover is shown from
 * (docs/superpowers/specs/2026-11-21-generated-cover-art-design.md).
 * Pure, and safe in client components: the project URL is NEXT_PUBLIC_.
 */

/** The public bucket generated covers live in, at `<meditation_id>/<random>.<ext>`. */
export const COVER_BUCKET = "meditation-covers";

/**
 * The public URL of a cover stored at `path`, or null when there is none
 * (the designed cover shows). Each path segment is encoded on its own, so the
 * folder's slash survives and nothing in a name can change the URL's shape.
 */
export function coverUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!path || !base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${COVER_BUCKET}/${encoded}`;
}

/**
 * A row read with `cover_path`, with `cover_url` added for MeditationCover.
 * Every read that feeds a cover passes its rows through this.
 */
export function withCoverUrl<T extends { cover_path?: string | null }>(row: T): T & { cover_url: string | null } {
  return { ...row, cover_url: coverUrl(row.cover_path) };
}

/**
 * Where a cover's 256px thumbnail lives, by convention beside the full image:
 * `<id>/<random>.webp` has `<id>/<random>.thumb.webp`. Takes a path or a URL
 * and changes only the file name. storeCover writes both; a cover set before
 * thumbnails existed has none, and MeditationCover falls back to the full
 * image when the thumbnail fails to load.
 */
export function coverThumb(pathOrUrl: string): string {
  const slash = pathOrUrl.lastIndexOf("/");
  const dot = pathOrUrl.lastIndexOf(".");
  if (dot <= slash) return `${pathOrUrl}.thumb`;
  return `${pathOrUrl.slice(0, dot)}.thumb${pathOrUrl.slice(dot)}`;
}

/**
 * The largest size (CSS px) a cover is drawn from its thumbnail. The
 * thumbnail is twice this, so it stays sharp on a 2x screen. Covers are
 * served as stored, not through Vercel's Image Optimization, whose Hobby
 * quota would run out within a few hundred covers.
 */
export const THUMB_MAX_SIZE = 128;
