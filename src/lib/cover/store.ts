import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import type { GeneratedImage } from "./generate";
import { UUID } from "./remove";
import { COVER_BUCKET, coverThumb, coverUrl, THUMB_MAX_SIZE } from "./url";

/** The full cover's edge. FLUX returns 1024px; nothing is ever enlarged. */
const FULL_EDGE = 1024;
/**
 * The thumbnail's edge: 2x of the largest cover MeditationCover draws from
 * it. Covers are served unoptimized, so small ones must not load the full
 * image.
 */
export const THUMB_EDGE = THUMB_MAX_SIZE * 2;

/** A cover's path is random and never rewritten, so it may be cached for a year. */
const CACHE_SECONDS = String(365 * 24 * 60 * 60);

/**
 * Whether `path` is a file directly inside `meditationId`'s own folder:
 * `<meditationId>/<file>`, nothing nested, nothing that climbs out. The only
 * paths storeCover will ever delete.
 */
export function isOwnCoverPath(path: string | null | undefined, meditationId: string): boolean {
  if (!path || !UUID.test(meditationId)) return false;
  const prefix = `${meditationId}/`;
  if (!path.startsWith(prefix)) return false;
  const file = path.slice(prefix.length);
  return file !== "" && file !== "." && file !== ".." && !/[/\\]/.test(file);
}

/**
 * The provider's image as two square WebPs: the full cover (at most 1024px,
 * cropped to a square if it came back otherwise) and its 256px thumbnail.
 * Re-encoding also means the bucket only ever holds what this made, whatever
 * format the provider returned.
 */
async function encode(bytes: Uint8Array): Promise<{ full: Buffer; thumb: Buffer }> {
  const source = sharp(bytes).rotate();
  const { width = FULL_EDGE, height = FULL_EDGE } = await source.metadata();
  const edge = Math.min(width, height, FULL_EDGE);
  const [full, thumb] = await Promise.all([
    source.clone().resize(edge, edge, { fit: "cover" }).webp({ quality: 82 }).toBuffer(),
    source.clone().resize(THUMB_EDGE, THUMB_EDGE, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { full, thumb };
}

/**
 * Store a generated cover as a meditation's current cover, on the service
 * role (only it writes covers; the caller has already proved ownership
 * through the owner's client). Uploads the full image and its thumbnail to
 * `<meditationId>/<random>.webp` and `.thumb.webp`, points `cover_path` at
 * it, then removes the previous cover pair, but only when it sits in this
 * meditation's own folder. If the row cannot be updated, the new objects are
 * removed and the old cover stays.
 */
export async function storeCover(
  meditationId: string,
  image: GeneratedImage,
): Promise<{ path: string; url: string }> {
  if (!UUID.test(meditationId)) throw new Error(`Not a meditation id: "${meditationId}"`);

  const { full, thumb } = await encode(image.bytes);
  const supabase = createServiceClient();
  const bucket = supabase.storage.from(COVER_BUCKET);

  const { data: current, error: readError } = await supabase
    .from("meditations")
    .select("cover_path")
    .eq("id", meditationId)
    .single();
  if (readError || !current) throw new Error(`Reading the meditation failed: ${readError?.message}`);
  const previous = current.cover_path as string | null;

  const path = `${meditationId}/${randomUUID()}.webp`;
  const thumbPath = coverThumb(path);
  const options = { contentType: "image/webp", cacheControl: CACHE_SECONDS, upsert: false };

  // The thumbnail first: by the time the row points at the full image, both exist.
  const uploaded: string[] = [];
  try {
    for (const [objectPath, body] of [
      [thumbPath, thumb],
      [path, full],
    ] as const) {
      const { error } = await bucket.upload(objectPath, body, options);
      if (error) throw new Error(`Cover upload failed: ${error.message}`);
      uploaded.push(objectPath);
    }
    const { error: updateError } = await supabase
      .from("meditations")
      .update({ cover_path: path })
      .eq("id", meditationId);
    if (updateError) throw new Error(`Saving the cover failed: ${updateError.message}`);
  } catch (error) {
    if (uploaded.length > 0) await bucket.remove(uploaded);
    throw error;
  }

  if (previous && previous !== path && isOwnCoverPath(previous, meditationId)) {
    // The new cover is already live; a leftover is removed with the meditation.
    const { error } = await bucket.remove([previous, coverThumb(previous)]);
    if (error) console.error("[cover] removing the previous cover failed", error.message);
  }

  return { path, url: coverUrl(path)! };
}
