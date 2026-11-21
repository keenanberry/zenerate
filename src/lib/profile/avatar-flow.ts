import { AVATAR_TYPES, avatarPath, ownAvatarPath, type AvatarType } from "./avatar";
import type { SaveResult } from "./form";
import { AvatarError } from "./resize-avatar";

/**
 * Changing and removing the profile photo on /account. The order is what
 * keeps a failure harmless: the new file is uploaded to a fresh path before
 * the profile points at it, and the old file is deleted only after the
 * profile has moved off it. A failed save takes back the file it uploaded.
 * Only a photo in the user's own folder is ever deleted (`ownAvatarPath`).
 */

export interface AvatarStorage {
  upload(
    path: string,
    body: Blob,
    options: { contentType: string; cacheControl: string; upsert: boolean },
  ): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
  publicUrl(path: string): string;
}

export interface AvatarDeps {
  userId: string;
  /** `avatarPublicBase(NEXT_PUBLIC_SUPABASE_URL)`. */
  publicBase: string;
  storage: AvatarStorage;
  /** PATCH /api/profile (`saveProfile`). */
  save(body: { avatar_url: string | null }): Promise<SaveResult>;
  /** The browser image step (`resizeAvatar`). */
  resize(file: File): Promise<Blob>;
  random(): string;
}

// The path is never reused, so a browser may keep the file for a year.
const CACHE_CONTROL = "31536000";

async function deleteOwn(url: string | null, deps: AvatarDeps) {
  const path = ownAvatarPath(url, deps.userId, deps.publicBase);
  if (!path) return;
  const { error } = await deps.storage.remove([path]);
  // The profile is already right; an orphaned file is a tidy-up, not a failure.
  if (error) console.error("Could not delete the previous profile photo:", error);
}

/** Resize, upload, point the profile at it, then delete the photo it replaced. */
export async function changeAvatar(file: File, previousUrl: string | null, deps: AvatarDeps): Promise<SaveResult> {
  let blob: Blob;
  try {
    blob = await deps.resize(file);
  } catch (error) {
    if (error instanceof AvatarError) return { ok: false, error: error.message };
    console.error("Could not prepare the profile photo:", error);
    return { ok: false, error: "Couldn't prepare that photo. Try another." };
  }
  if (!(blob.type in AVATAR_TYPES)) return { ok: false, error: "Couldn't prepare that photo. Try another." };
  const type = blob.type as AvatarType;

  const path = avatarPath(deps.userId, deps.random(), type);
  try {
    const { error } = await deps.storage.upload(path, blob, {
      contentType: type,
      cacheControl: CACHE_CONTROL,
      upsert: false,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Could not upload the profile photo:", error);
    return { ok: false, error: "Couldn't upload that photo. Check your connection and try again." };
  }

  const result = await deps.save({ avatar_url: deps.storage.publicUrl(path) });
  if (!result.ok) {
    await deleteOwn(deps.storage.publicUrl(path), deps).catch(() => {});
    return result;
  }
  await deleteOwn(previousUrl, deps).catch((error) => console.error(error));
  return result;
}

/** Clear the profile's photo, then delete the file if it was an upload of theirs. */
export async function removeAvatar(previousUrl: string | null, deps: AvatarDeps): Promise<SaveResult> {
  const result = await deps.save({ avatar_url: null });
  if (!result.ok) return result;
  await deleteOwn(previousUrl, deps).catch((error) => console.error(error));
  return result;
}
