/**
 * Profile photos (docs/superpowers/specs/2026-11-21-avatar-upload-design.md).
 * The browser centre-crops a picked photo to one 512px WebP square and
 * uploads it to the public `avatars` bucket at `<user id>/<random>.webp`;
 * the storage policies in the avatars_bucket migration let a user write only
 * under their own folder. Pure helpers here; the canvas step is
 * resize-avatar.ts.
 */

export const AVATAR_BUCKET = "avatars";

/** The stored square's side in pixels. Every display is a circle over it. */
export const AVATAR_SIZE = 512;

/** Refused before decoding: a phone photo is a few MB, not tens. */
export const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** The bucket's own file_size_limit; an encode over it is retried smaller, then refused. */
export const AVATAR_MAX_OUTPUT_BYTES = 1024 * 1024;

/** The largest centred square of a width × height image, in whole source pixels. */
export function centreSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/** Where a new photo goes: the user's folder (what the storage policies check) and a fresh name. */
export function avatarPath(userId: string, random: string): string {
  return `${userId}/${random}.webp`;
}

/** The prefix of every public URL in the bucket, from the Supabase project URL. */
export function avatarPublicBase(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/`;
}

/**
 * The object path of `url` when it is a public URL in the avatars bucket,
 * directly in this user's folder; otherwise null. Only such a path is ever
 * deleted, so an external URL (an avatar from before uploads) or anything
 * outside the user's folder is left alone. The storage policies refuse those
 * deletes anyway; this keeps the client from trying.
 */
export function ownAvatarPath(url: string | null, userId: string, bucketPublicBase: string): string | null {
  if (!url || !userId) return null;
  const base = bucketPublicBase.endsWith("/") ? bucketPublicBase : `${bucketPublicBase}/`;
  if (!url.startsWith(base)) return null;
  const path = url.slice(base.length);
  const prefix = `${userId}/`;
  if (!path.startsWith(prefix)) return null;
  const name = path.slice(prefix.length);
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) return null;
  return path;
}
