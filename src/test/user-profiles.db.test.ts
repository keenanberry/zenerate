/**
 * User profiles (card ZEN-2), against a real local Supabase: the grants, RLS
 * policies and SECURITY DEFINER functions in 20261120000000_user_profiles.sql
 * are checked by Postgres, so only a database can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/user-profiles.db.test.ts
 *
 * Each run makes two throwaway users, one opted in and one private, and
 * deletes them at the end (their profiles go with them by cascade); the
 * seeded accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { PUBLIC_PROFILE_COLUMNS } from "@/lib/profile/profile";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";

describe.skipIf(!enabled)("user profiles against local Supabase", () => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  let service: SupabaseClient;
  let anon: SupabaseClient;
  // Public: opted in. Private: never did.
  let publicUser: { id: string; client: SupabaseClient; meditationId: string };
  let privateUser: { id: string; client: SupabaseClient; meditationId: string };

  async function makeUser(label: string) {
    const email = `zen2-${label}-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    // A public, completed meditation: what Discover shows.
    const { data: med, error: medError } = await service
      .from("meditations")
      .insert({
        user_id: data.user.id,
        title: `ZEN-2 ${label}`,
        script: "Breathe.",
        status: "completed",
        audio_path: `${data.user.id}/x/r.mp3`,
        is_public: true,
        settings: {},
      })
      .select("id")
      .single();
    if (medError) throw medError;
    return { id: data.user.id, client, meditationId: med.id as string };
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);
    publicUser = await makeUser("public");
    privateUser = await makeUser("private");
    const { error } = await publicUser.client
      .from("user_profiles")
      .update({ display_name: "Opted In", is_public: true })
      .eq("id", publicUser.id);
    if (error) throw error;
  });

  afterAll(async () => {
    for (const user of [publicUser, privateUser]) {
      if (user) await service.auth.admin.deleteUser(user.id);
    }
  });

  it("gives every new account an empty, private profile", async () => {
    const { data, error } = await privateUser.client
      .from("user_profiles")
      .select("id, display_name, bio, avatar_url, is_public")
      .eq("id", privateUser.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: privateUser.id, display_name: null, bio: null, avatar_url: null, is_public: false });
  });

  describe("the owner", () => {
    it("edits the profile columns", async () => {
      const { data, error } = await privateUser.client
        .from("user_profiles")
        .update({ bio: "Hi", avatar_url: "https://example.com/a.png", updated_at: new Date().toISOString() })
        .eq("id", privateUser.id)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it.each([
      ["id", randomUUID()],
      ["created_at", "2000-01-01T00:00:00Z"],
    ])("may not change %s", async (column, value) => {
      const { error } = await privateUser.client
        .from("user_profiles")
        .update({ [column]: value })
        .eq("id", privateUser.id);
      expect(error?.code).toBe(PERMISSION_DENIED);
    });

    it("may not insert or delete a profile", async () => {
      const insert = await privateUser.client.from("user_profiles").insert({ id: privateUser.id });
      expect(insert.error?.code).toBe(PERMISSION_DENIED);
      const del = await privateUser.client.from("user_profiles").delete().eq("id", privateUser.id);
      expect(del.error?.code).toBe(PERMISSION_DENIED);
    });

    it("cannot edit someone else's profile", async () => {
      const { data, error } = await privateUser.client
        .from("user_profiles")
        .update({ bio: "Hijacked" })
        .eq("id", publicUser.id)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it.each([
      ["avatar_url", "http://example.com/a.png"],
      ["avatar_url", "HTTPS://example.com/a.png"],
      ["display_name", "x".repeat(51)],
      ["display_name", ""],
      ["bio", "x".repeat(301)],
    ])("is held to the %s check even straight through PostgREST", async (column, value) => {
      const { error } = await privateUser.client
        .from("user_profiles")
        .update({ [column]: value })
        .eq("id", privateUser.id);
      expect(error?.code).toBe(CHECK_VIOLATION);
    });
  });

  describe("anon", () => {
    it("reads opted-in profiles only, through the public columns", async () => {
      const { data, error } = await anon
        .from("user_profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .in("id", [publicUser.id, privateUser.id]);
      expect(error).toBeNull();
      expect(data!.map((p) => p.id)).toEqual([publicUser.id]);
    });

    it("cannot read updated_at or write anything", async () => {
      const read = await anon.from("user_profiles").select("updated_at").limit(1);
      expect(read.error?.code).toBe(PERMISSION_DENIED);
      const write = await anon.from("user_profiles").update({ bio: "x" }).eq("id", publicUser.id);
      expect(write.error?.code).toBe(PERMISSION_DENIED);
    });

    it("lists an opted-in profile's meditations, and none of a private one's", async () => {
      const listed = await anon.rpc("profile_meditations", { p_profile_id: publicUser.id });
      expect(listed.error).toBeNull();
      expect(listed.data.map((m: { id: string }) => m.id)).toEqual([publicUser.meditationId]);
      expect(Object.keys(listed.data[0])).not.toContain("user_id");
      expect(Object.keys(listed.data[0])).not.toContain("audio_path");

      const hidden = await anon.rpc("profile_meditations", { p_profile_id: privateUser.id });
      expect(hidden.error).toBeNull();
      expect(hidden.data).toEqual([]);
    });

    it("names the author of a meditation only when that author opted in", async () => {
      const { data, error } = await anon.rpc("meditation_authors", {
        p_meditation_ids: [publicUser.meditationId, privateUser.meditationId],
      });
      expect(error).toBeNull();
      expect(data).toEqual([
        { meditation_id: publicUser.meditationId, author_id: publicUser.id, display_name: "Opted In", avatar_url: null },
      ]);
    });
  });

  it("lets a private profile's owner preview their meditations, and nobody else", async () => {
    const own = await privateUser.client.rpc("profile_meditations", { p_profile_id: privateUser.id });
    expect(own.data.map((m: { id: string }) => m.id)).toEqual([privateUser.meditationId]);
    const other = await publicUser.client.rpc("profile_meditations", { p_profile_id: privateUser.id });
    expect(other.data).toEqual([]);
  });
});
