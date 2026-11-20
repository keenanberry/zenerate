import { z } from "zod";

/**
 * A person's profile, one per account (public.user_profiles). Every text
 * field is optional, and a new account starts with an empty, private
 * profile: is_public is the owner's opt-in to being shown.
 */
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** What anyone may read of a public profile; the anon grant names the same columns. */
export type PublicProfile = Omit<Profile, "updated_at">;

export const PROFILE_COLUMNS = "id, display_name, avatar_url, bio, is_public, created_at, updated_at";
export const PUBLIC_PROFILE_COLUMNS = "id, display_name, avatar_url, bio, is_public, created_at";

/** Kept in step with the check constraints in the user_profiles migration. */
export const PROFILE_LIMITS = { displayName: 50, bio: 300, avatarUrl: 2048 } as const;

export type ProfileUpdate = Partial<Pick<Profile, "display_name" | "avatar_url" | "bio" | "is_public">>;

/** Trimmed text, with blank text read as "clear this field". */
const optionalText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max))
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

const avatarUrl = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z.union([
      z.literal(""),
      z
        .url({ protocol: /^https$/ })
        .max(PROFILE_LIMITS.avatarUrl),
    ]),
  )
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const updateSchema = z
  .strictObject({
    display_name: optionalText(PROFILE_LIMITS.displayName),
    bio: optionalText(PROFILE_LIMITS.bio),
    avatar_url: avatarUrl,
    is_public: z.boolean().optional(),
  })
  .refine((u) => Object.keys(u).length > 0, { message: "Nothing to update" });

/**
 * A PATCH body checked against what the owner may change. Only the fields
 * sent are returned, so a partial update leaves the others alone; a field
 * sent as null or blank text clears it. Unknown keys (id, created_at) are
 * refused rather than dropped, so a client learns its write did not happen.
 */
export function parseProfileUpdate(
  body: unknown,
): { ok: true; update: ProfileUpdate } | { ok: false; error: string } {
  const result = updateSchema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
  }
  const update: ProfileUpdate = {};
  const { display_name, bio, avatar_url, is_public } = result.data;
  if (display_name !== undefined) update.display_name = display_name;
  if (bio !== undefined) update.bio = bio;
  if (avatar_url !== undefined) update.avatar_url = avatar_url;
  if (is_public !== undefined) update.is_public = is_public;
  return { ok: true, update };
}
