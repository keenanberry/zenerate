import {
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_OUTPUT_BYTES,
  AVATAR_MAX_PIXELS,
  AVATAR_SIZE,
  centreSquare,
  type AvatarType,
} from "./avatar";

/**
 * The browser half of a profile photo: a picked file becomes one
 * AVATAR_SIZE square, the largest centred square of the photo, re-encoded so
 * none of the original's metadata (EXIF, GPS) survives. Client only: it
 * needs a DOM canvas.
 */

/** A failure whose message is fit to show the person as it is. */
export class AvatarError extends Error {
  name = "AvatarError";
}

const QUALITY = 0.85;
const RETRY_QUALITY = 0.6;

/** Why this file cannot be used, before spending time decoding it, or null. */
export function checkAvatarFile(file: { type: string; size: number }): string | null {
  // An empty type is unknown, not "not an image" (some browsers report HEIC
  // so); the decoder decides.
  if (file.type && !file.type.startsWith("image/")) return "Choose an image file.";
  if (file.size > AVATAR_MAX_INPUT_BYTES) return "That photo is over 15 MB. Choose a smaller one.";
  return null;
}

/** Why a decoded image is unusable (empty, or too many pixels to draw safely), or null. */
export function checkAvatarDimensions(width: number, height: number): string | null {
  if (!width || !height) return "Couldn't read that photo. Try a JPEG or PNG.";
  if (width * height > AVATAR_MAX_PIXELS) return "That photo is too large to use. Choose one under 50 megapixels.";
  return null;
}

type Encode = (type: AvatarType, quality: number) => Promise<Blob | null>;

/**
 * WebP where the browser can encode it, else JPEG: Safari asked for WebP
 * hands back PNG, which the bucket refuses. An encode over the bucket's
 * 1 MB is tried once more at a lower quality, then refused.
 */
export async function encodeAvatar(encode: Encode): Promise<Blob> {
  let type: AvatarType = "image/webp";
  let blob = await encode(type, QUALITY);
  if (blob?.type !== type) {
    type = "image/jpeg";
    blob = await encode(type, QUALITY);
  }
  if (!blob || blob.type !== type) throw new AvatarError("Couldn't prepare that photo. Try another.");
  if (blob.size <= AVATAR_MAX_OUTPUT_BYTES) return blob;

  const smaller = await encode(type, RETRY_QUALITY);
  if (!smaller || smaller.type !== type || smaller.size > AVATAR_MAX_OUTPUT_BYTES) {
    throw new AvatarError("That photo is too large to save, even made smaller. Try another.");
  }
  return smaller;
}

type Source = { image: CanvasImageSource; width: number; height: number; close: () => void };

/**
 * createImageBitmap, which honours the photo's EXIF orientation, or an
 * <img> where that cannot read the file. Either way the pixels come out
 * upright and the metadata stays behind.
 */
async function decode(file: File): Promise<Source> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Fall through to an <img>, which decodes some formats a bitmap will not.
  }
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(src),
    };
  } catch {
    URL.revokeObjectURL(src);
    throw new AvatarError("Couldn't read that photo. Try a JPEG or PNG.");
  }
}

/** A picked file as the square to upload, or an AvatarError to show. */
export async function resizeAvatar(file: File): Promise<Blob> {
  const problem = checkAvatarFile(file);
  if (problem) throw new AvatarError(problem);

  const source = await decode(file);
  try {
    const tooBig = checkAvatarDimensions(source.width, source.height);
    if (tooBig) throw new AvatarError(tooBig);
    const { sx, sy, size } = centreSquare(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarError("Couldn't prepare that photo. Try another.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.image, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    let flattened = false;
    return await encodeAvatar((type, quality) => {
      // JPEG has no transparency: put a transparent PNG on white rather
      // than the black a canvas would give it.
      if (type === "image/jpeg" && !flattened) {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        ctx.globalCompositeOperation = "source-over";
        flattened = true;
      }
      return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    });
  } finally {
    source.close();
  }
}
