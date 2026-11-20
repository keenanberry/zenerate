import { parseProfileUpdate, type Profile, type ProfileUpdate } from "./profile";

/** What the account page's profile form holds: text as typed, plus the switch. */
export interface ProfileFormValues {
  display_name: string;
  bio: string;
  avatar_url: string;
  is_public: boolean;
}

export type ProfileField = keyof ProfileFormValues;

export function toFormValues(profile: Pick<Profile, ProfileField>): ProfileFormValues {
  return {
    display_name: profile.display_name ?? "",
    bio: profile.bio ?? "",
    avatar_url: profile.avatar_url ?? "",
    is_public: profile.is_public,
  };
}

const TEXT_FIELDS = ["display_name", "bio", "avatar_url"] as const;

/**
 * The fields that differ from what was last saved, as a PATCH body for
 * /api/profile, or null when nothing changed. Text compares trimmed, as the
 * API stores it, so stray spaces alone are not a change.
 */
export function changedFields(
  saved: ProfileFormValues,
  values: ProfileFormValues,
): Partial<ProfileFormValues> | null {
  const body: Partial<ProfileFormValues> = {};
  for (const field of TEXT_FIELDS) {
    if (values[field].trim() !== saved[field].trim()) body[field] = values[field];
  }
  if (values.is_public !== saved.is_public) body.is_public = values.is_public;
  return Object.keys(body).length > 0 ? body : null;
}

/**
 * Each field's problem, checked one field at a time by the same parser the
 * API runs, so the form names the field and refuses exactly what the server
 * would. Only the last, most specific message is kept: a bad avatar fails
 * both the URL check and the https:// one.
 */
export function fieldErrors(body: Partial<ProfileFormValues>): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {};
  for (const [field, value] of Object.entries(body) as [ProfileField, unknown][]) {
    const result = parseProfileUpdate({ [field]: value });
    if (!result.ok) errors[field] = result.error.split("; ").at(-1);
  }
  return errors;
}

export type SaveResult = { ok: true; profile: Profile } | { ok: false; error: string };

/** PATCH /api/profile. The API's own message comes back on a refusal. */
export async function saveProfile(
  body: ProfileUpdate | Partial<ProfileFormValues>,
  fetchImpl: typeof fetch = fetch,
): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetchImpl("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data && typeof data.error === "string" ? data.error : "Couldn't save your profile";
    return { ok: false, error };
  }
  return { ok: true, profile: data as Profile };
}
