import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, parseProfileUpdate } from "@/lib/profile/profile";
import { avatarPublicBase, ownAvatarPath } from "@/lib/profile/avatar";

/**
 * The signed-in user's own profile. Both methods run on the user's own
 * client, so RLS (select_own, update_own) and the column grants on
 * user_profiles hold even if this code were wrong. Every account has a row:
 * a trigger on auth.users creates it.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to see your profile" }, 401);

  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Could not read profile:", error);
    return json({ error: "Could not load your profile" }, 500);
  }
  if (!data) return json({ error: "Profile not found" }, 404);
  return json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to edit your profile" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const parsed = parseProfileUpdate(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  // A new photo must be one this user uploaded: a public URL directly in
  // their own avatars folder, as the Account page writes. Anything else (an
  // external image, which could track whoever views a public profile, or
  // someone else's upload) is refused. Clearing is always allowed, and a
  // value stored before this rule stays until the owner changes it.
  const avatar = parsed.update.avatar_url;
  if (
    avatar &&
    !ownAvatarPath(avatar, user.id, avatarPublicBase(process.env.NEXT_PUBLIC_SUPABASE_URL!))
  ) {
    return json({ error: "Upload a photo from your account page instead of linking one" }, 400);
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ ...parsed.update, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("Could not update profile:", error);
    return json({ error: "Could not save your profile" }, 500);
  }
  if (!data) return json({ error: "Profile not found" }, 404);
  return json(data);
}
