import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_PROFILE_COLUMNS } from "@/lib/profile/profile";

/**
 * Someone's public profile and their public meditations, readable signed
 * out. A profile is shown only when its owner has opted in (is_public), or
 * to the owner themselves so they can preview it.
 *
 * Authorization is structural: the read runs on the caller's own client, so
 * RLS (select_public, select_own) decides whether the row comes back, and
 * profile_meditations applies the same rule in SQL. A private profile and a
 * missing one get the same 404, so the route says nothing about who has an
 * account.
 *
 * Meditations come back without audio. Signed URLs are minted only in
 * src/lib/meditation/actions.ts (an ESLint rule keeps it so); a page that
 * plays them reads through there.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

const notFound = () => json({ error: "Profile not found" }, 404);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("Could not read profile:", error);
    return json({ error: "Could not load this profile" }, 500);
  }
  if (!profile) return notFound();

  const { data: rows, error: listError } = await supabase.rpc("profile_meditations", {
    p_profile_id: id,
  });
  if (listError) {
    console.error("Could not list profile meditations:", listError);
    return json({ error: "Could not load this profile" }, 500);
  }

  // A list needs no scripts; they are most of each row's bytes.
  const meditations = ((rows ?? []) as Record<string, unknown>[]).map((row) => {
    const rest = { ...row };
    delete rest.script;
    return rest;
  });
  return json({ profile, meditations });
}
