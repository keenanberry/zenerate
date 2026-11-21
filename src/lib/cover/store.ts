import { randomUUID } from "node:crypto";
import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import type { GeneratedImage } from "./generate";
import { UUID } from "./remove";
import { COVER_BUCKET, coverMiddle, coverThumb, coverUrl, MIDDLE_MAX_SIZE, THUMB_MAX_SIZE } from "./url";

/** The full cover's edge. FLUX returns 1024px; nothing is ever enlarged. */
const FULL_EDGE = 1024;
/**
 * The thumbnail's edge: 2x of the largest cover MeditationCover draws from
 * it. Covers are served unoptimized, so small ones must not load the full
 * image.
 */
export const THUMB_EDGE = THUMB_MAX_SIZE * 2;
/** The middle size's edge: 2x of the largest card MeditationCover draws from it. */
export const MIDDLE_EDGE = MIDDLE_MAX_SIZE * 2;

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
 * The provider's image as three square WebPs: the full cover (at most
 * 1024px, cropped to a square if it came back otherwise), its 512px middle
 * size and its 256px thumbnail.
 * Re-encoding also means the bucket only ever holds what this made, whatever
 * format the provider returned.
 */
async function encode(bytes: Uint8Array): Promise<{ full: Buffer; middle: Buffer; thumb: Buffer }> {
  // Loaded here, not at the top: sharp is a native module, and this file is
  // reached from the chat route. If its binary failed to load, a top-level
  // import would take the whole studio down; here it fails one cover, which
  // makeCover releases like any other failure.
  const { default: sharp } = await import("sharp");
  const source = sharp(bytes).rotate();
  const { width = FULL_EDGE, height = FULL_EDGE } = await source.metadata();
  const edge = Math.min(width, height, FULL_EDGE);
  const [full, middle, thumb] = await Promise.all([
    source.clone().resize(edge, edge, { fit: "cover" }).webp({ quality: 82 }).toBuffer(),
    source.clone().resize(MIDDLE_EDGE, MIDDLE_EDGE, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
    source.clone().resize(THUMB_EDGE, THUMB_EDGE, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { full, middle, thumb };
}

/**
 * The meditation's cover was no longer what the caller expected when the row
 * was written (a studio cover appeared meanwhile, or the meditation is gone).
 * Nothing was changed: the uploads were removed and the row kept its cover.
 */
export class CoverChangedError extends Error {
  constructor() {
    super("A cover appeared since generation (or the meditation is gone); it was left as it is.");
    this.name = "CoverChangedError";
  }
}

/**
 * Store a generated cover as a meditation's current cover, on the service
 * role (only it writes covers; the caller has already proved ownership
 * through the owner's client, or the operator runs the backfill). Uploads the
 * full image, its middle size and its thumbnail to
 * `<meditationId>/<random>.webp`, `.md.webp` and `.thumb.webp`, points
 * `cover_path` at it, then removes the previous cover's sizes, but only when
 * it sits in this meditation's own folder. If the row cannot be updated, the
 * new objects are removed and the old cover stays.
 *
 * `ifCoverIs` makes the write conditional, for the backfill: the row is
 * updated only while its cover_path is still that value (null: no cover), in
 * the same statement as the update, so a cover the studio made after the
 * caller looked is never overwritten. Otherwise it throws CoverChangedError
 * having removed its own uploads.
 */
export async function storeCover(
  meditationId: string,
  image: GeneratedImage,
  { ifCoverIs }: { ifCoverIs?: string | null } = {},
): Promise<{ path: string; url: string }> {
  if (!UUID.test(meditationId)) throw new Error(`Not a meditation id: "${meditationId}"`);

  const { full, middle, thumb } = await encode(image.bytes);
  const supabase = createServiceClient();
  const bucket = supabase.storage.from(COVER_BUCKET);

  const { data: current, error: readError } = await supabase
    .from("meditations")
    .select("cover_path")
    .eq("id", meditationId)
    .single();
  if (readError || !current) throw new Error(`Reading the meditation failed: ${readError?.message}`);
  const previous = current.cover_path as string | null;
  const conditional = ifCoverIs !== undefined;
  // Already changed: nothing to upload.
  if (conditional && previous !== ifCoverIs) throw new CoverChangedError();

  const path = `${meditationId}/${randomUUID()}.webp`;
  const thumbPath = coverThumb(path);
  const options = { contentType: "image/webp", cacheControl: CACHE_SECONDS, upsert: false };

  // The smaller sizes first: by the time the row points at the full image, all three exist.
  const uploaded: string[] = [];
  try {
    for (const [objectPath, body] of [
      [thumbPath, thumb],
      [coverMiddle(path), middle],
      [path, full],
    ] as const) {
      const { error } = await bucket.upload(objectPath, body, options);
      if (error) throw new Error(`Cover upload failed: ${error.message}`);
      uploaded.push(objectPath);
    }
    let update = supabase.from("meditations").update({ cover_path: path }).eq("id", meditationId);
    if (conditional) {
      update = ifCoverIs === null ? update.is("cover_path", null) : update.eq("cover_path", ifCoverIs);
    }
    const { data: updated, error: updateError } = await update.select("id");
    if (updateError) throw new Error(`Saving the cover failed: ${updateError.message}`);
    // Nothing points at the upload: deleted while the cover was being made,
    // or (conditional) its cover changed since the caller looked.
    if (!updated?.length) {
      if (conditional) throw new CoverChangedError();
      throw new Error("Saving the cover failed: the meditation is gone.");
    }
  } catch (error) {
    if (uploaded.length > 0) {
      const { error: removeError } = await bucket.remove(uploaded);
      if (removeError) console.error("[cover] removing an unused upload failed", removeError.message);
    }
    throw error;
  }

  if (previous && previous !== path && isOwnCoverPath(previous, meditationId)) {
    // The new cover is already live; a leftover is removed with the meditation.
    // A cover stored before a size existed lacks it; removing a missing object is not an error.
    const { error } = await bucket.remove([previous, coverMiddle(previous), coverThumb(previous)]);
    if (error) console.error("[cover] removing the previous cover failed", error.message);
  }

  return { path, url: coverUrl(path)! };
}
