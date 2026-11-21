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
 * A smaller size of a cover, by convention beside the full image:
 * `<id>/<random>.webp` has `<id>/<random>.<size>.webp`. Takes a path or a
 * URL and changes only the file name.
 */
function coverSize(pathOrUrl: string, size: "thumb" | "md"): string {
  const slash = pathOrUrl.lastIndexOf("/");
  const dot = pathOrUrl.lastIndexOf(".");
  if (dot <= slash) return `${pathOrUrl}.${size}`;
  return `${pathOrUrl.slice(0, dot)}.${size}${pathOrUrl.slice(dot)}`;
}

/**
 * Where a cover's 256px thumbnail lives: `<id>/<random>.thumb.webp`.
 * storeCover writes it; a cover set before thumbnails existed has none, and
 * MeditationCover moves on to the next larger size when it fails to load.
 */
export function coverThumb(pathOrUrl: string): string {
  return coverSize(pathOrUrl, "thumb");
}

/**
 * Where a cover's 512px middle size lives: `<id>/<random>.md.webp`. Covers
 * stored before cover art PR 3 have none and fall back to the full image.
 */
export function coverMiddle(pathOrUrl: string): string {
  return coverSize(pathOrUrl, "md");
}

/**
 * The largest size (CSS px) a cover is drawn from its thumbnail. The
 * thumbnail is twice this, so it stays sharp on a 2x screen. Covers are
 * served as stored, not through Vercel's Image Optimization, whose Hobby
 * quota would run out within a few hundred covers.
 */
export const THUMB_MAX_SIZE = 128;

/**
 * The largest size (CSS px) a cover is drawn from its middle size, which is
 * twice this: the 176–240px cards on Discover and in the Library. Larger
 * (the meditation page, the session view) loads the full image.
 */
export const MIDDLE_MAX_SIZE = 256;
