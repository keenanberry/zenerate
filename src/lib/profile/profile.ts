import { z } from "zod";

/**
 * A person's profile, one per account (public.user_profiles). Every field is
 * optional: a new account starts with an empty profile.
 */
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export const PROFILE_COLUMNS = "id, display_name, avatar_url, bio, created_at, updated_at";

/** Kept in step with the check constraints in the user_profiles migration. */
export const PROFILE_LIMITS = { displayName: 50, bio: 300, avatarUrl: 2048 } as const;

export type ProfileUpdate = Partial<Pick<Profile, "display_name" | "avatar_url" | "bio">>;

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
  for (const key of ["display_name", "bio", "avatar_url"] as const) {
    if (result.data[key] !== undefined) update[key] = result.data[key];
  }
  return { ok: true, update };
}
