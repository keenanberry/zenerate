/**
 * Meditation ratings (card ZEN-5), against a real local Supabase: the
 * policies, column grants, the stars check and the cascades are Postgres's to
 * enforce, so only a database can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, or `supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/meditation-ratings.db.test.ts
 *
 * Each run makes four throwaway users and deletes them at the end; the
 * seeded accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { deleteOwnRating, getOwnRating, getRatingStats, rateMeditation } from "@/lib/meditation/ratings";
import { deleteOwnMeditation } from "@/lib/meditation/delete";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const options = { auth: { autoRefreshToken: false, persistSession: false } };

describe.skipIf(!enabled)("meditation ratings against local Supabase", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const users: string[] = [];
  let ownerId: string;
  let owner: SupabaseClient;
  let aliceId: string;
  let alice: SupabaseClient;
  let bobId: string;
  let bob: SupabaseClient;
  let publicId: string;
  let privateId: string;

  async function makeUser() {
    const email = `zen5-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    users.push(data.user.id);
    return { id: data.user.id, client };
  }

  async function makeMeditation(isPublic: boolean) {
    const { data, error } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title: "ZEN-5", script: "Breathe.", status: "script_ready", is_public: false, settings: {} })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e } = await service
      .from("meditations")
      .update({ status: "completed", audio_path: `${ownerId}/${data.id}/r.mp3`, is_public: isPublic })
      .eq("id", data.id);
    if (e) throw e;
    return data.id as string;
  }

  async function rows(meditationId: string) {
    const { data, error } = await service
      .from("meditation_ratings")
      .select("user_id, stars")
      .eq("meditation_id", meditationId)
      .order("stars");
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);
    ({ id: ownerId, client: owner } = await makeUser());
    ({ id: aliceId, client: alice } = await makeUser());
    ({ id: bobId, client: bob } = await makeUser());
    publicId = await makeMeditation(true);
    privateId = await makeMeditation(false);
  });

  afterAll(async () => {
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  describe("a listener's own rating", () => {
    it("is created, read, changed and kept to one row", async () => {
      expect(await getOwnRating(alice, aliceId, publicId)).toEqual({ ok: true, value: null });

      const created = await rateMeditation(alice, aliceId, publicId, 5);
      expect(created.ok && created.value.created).toBe(true);
      const changed = await rateMeditation(alice, aliceId, publicId, 3);
      expect(changed.ok && changed.value).toMatchObject({ created: false, rating: { stars: 3 } });

      const read = await getOwnRating(alice, aliceId, publicId);
      expect(read.ok && read.value?.stars).toBe(3);
      expect(await rows(publicId)).toEqual([{ user_id: aliceId, stars: 3 }]);

      // A second row straight through PostgREST meets the primary key.
      const { error } = await alice.from("meditation_ratings").insert({ meditation_id: publicId, user_id: aliceId, stars: 4 });
      expect(error?.code).toBe("23505");
    });

    it("keeps created_at and moves updated_at; neither can be written", async () => {
      const { data: before } = await service
        .from("meditation_ratings").select("created_at, updated_at").eq("meditation_id", publicId).eq("user_id", aliceId).single();
      await rateMeditation(alice, aliceId, publicId, 4);
      const { data: after } = await service
        .from("meditation_ratings").select("created_at, updated_at").eq("meditation_id", publicId).eq("user_id", aliceId).single();
      expect(after!.created_at).toBe(before!.created_at);
      expect(after!.updated_at > before!.updated_at).toBe(true);

      const { error } = await alice
        .from("meditation_ratings").update({ created_at: "2000-01-01" }).eq("meditation_id", publicId).eq("user_id", aliceId);
      expect(error?.code).toBe("42501");
    });

    it("cannot be moved to another meditation or person", async () => {
      for (const patch of [{ meditation_id: privateId }, { user_id: bobId }]) {
        const { error } = await alice
          .from("meditation_ratings").update(patch).eq("meditation_id", publicId).eq("user_id", aliceId);
        expect(error?.code, JSON.stringify(patch)).toBe("42501");
      }
    });

    it("is removed, and removing again is harmless", async () => {
      await rateMeditation(bob, bobId, publicId, 2);
      expect(await deleteOwnRating(bob, bobId, publicId)).toEqual({ ok: true, value: null });
      expect(await deleteOwnRating(bob, bobId, publicId)).toEqual({ ok: true, value: null });
      expect(await rows(publicId)).toEqual([{ user_id: aliceId, stars: 4 }]);
    });
  });

  describe("refusals", () => {
    it("refuses stars outside 1 to 5", async () => {
      for (const stars of [0, 6, -1]) {
        const { error } = await bob.from("meditation_ratings").insert({ meditation_id: publicId, user_id: bobId, stars });
        expect(error?.code, String(stars)).toBe("23514");
      }
      const { error } = await alice
        .from("meditation_ratings").update({ stars: 9 }).eq("meditation_id", publicId).eq("user_id", aliceId);
      expect(error?.code).toBe("23514");
    });

    it("refuses a private meditation, through the API code and around it", async () => {
      expect(await rateMeditation(bob, bobId, privateId, 4)).toEqual({ ok: false, reason: "not_found" });
      const { error } = await bob.from("meditation_ratings").insert({ meditation_id: privateId, user_id: bobId, stars: 4 });
      expect(error?.code).toBe("42501");
      expect(await rows(privateId)).toEqual([]);
    });

    it("refuses the owner on their own meditation", async () => {
      expect(await rateMeditation(owner, ownerId, publicId, 5)).toEqual({ ok: false, reason: "own" });
      const { error } = await owner.from("meditation_ratings").insert({ meditation_id: publicId, user_id: ownerId, stars: 5 });
      expect(error?.code).toBe("42501");
    });

    it("refuses a rating written in someone else's name", async () => {
      const { error } = await bob.from("meditation_ratings").insert({ meditation_id: publicId, user_id: aliceId, stars: 1 });
      expect(error?.code).toBe("42501");
    });

    it("gives signed-out visitors nothing: no rows, no writes", async () => {
      const read = await anon.from("meditation_ratings").select("stars");
      expect(read.error?.code).toBe("42501");
      const write = await anon.from("meditation_ratings").insert({ meditation_id: publicId, user_id: aliceId, stars: 1 });
      expect(write.error?.code).toBe("42501");
    });

    it("hides other listeners' ratings and refuses to change or remove them", async () => {
      const { data } = await bob.from("meditation_ratings").select("user_id, stars");
      expect(data).toEqual([]);

      const updated = await bob
        .from("meditation_ratings").update({ stars: 1 }).eq("meditation_id", publicId).eq("user_id", aliceId).select("stars");
      expect(updated.data ?? []).toEqual([]);
      const deleted = await bob
        .from("meditation_ratings").delete().eq("meditation_id", publicId).eq("user_id", aliceId).select("stars");
      expect(deleted.data ?? []).toEqual([]);
      expect(await rows(publicId)).toEqual([{ user_id: aliceId, stars: 4 }]);
    });
  });

  describe("meditation_rating_stats", () => {
    it("returns the one-decimal average and count to anyone, signed out included", async () => {
      await rateMeditation(bob, bobId, publicId, 5);
      // 4 and 5.
      for (const client of [anon, bob, owner]) {
        const stats = await getRatingStats(client, [publicId, privateId]);
        expect(stats.get(publicId)).toEqual({ average: 4.5, count: 2 });
        expect(stats.has(privateId)).toBe(false);
      }
    });

    it("rounds to one decimal", async () => {
      const carol = await makeUser();
      await rateMeditation(carol.client, carol.id, publicId, 5);
      // 4, 5 and 5: 4.666… shows as 4.7.
      expect((await getRatingStats(anon, [publicId])).get(publicId)).toEqual({ average: 4.7, count: 3 });
    });

    it("leaves out a meditation once it is private, and its ratings freeze", async () => {
      await owner.from("meditations").update({ is_public: false }).eq("id", publicId);
      try {
        expect((await getRatingStats(anon, [publicId])).has(publicId)).toBe(false);
        expect(await rateMeditation(alice, aliceId, publicId, 1)).toEqual({ ok: false, reason: "not_found" });
        const { error } = await alice
          .from("meditation_ratings").update({ stars: 1 }).eq("meditation_id", publicId).eq("user_id", aliceId);
        expect(error?.code).toBe("42501");
      } finally {
        await service.from("meditations").update({ is_public: true }).eq("id", publicId);
      }
    });
  });

  it("goes with the meditation when its owner deletes it", async () => {
    expect((await rows(publicId)).length).toBe(3);
    expect(await deleteOwnMeditation(owner, ownerId, publicId)).toEqual({ ok: true });
    expect(await rows(publicId)).toEqual([]);
  });
});
