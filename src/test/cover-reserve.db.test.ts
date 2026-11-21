/**
 * The studio's cover cap (20261121020000_cover_generation_rpc.sql): reserve
 * and release against a real local Supabase. Parallel tool calls must not
 * both pass at 2 of 3, which only a running Postgres can show.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/cover-reserve.db.test.ts
 *
 * Each run makes one throwaway user and meditation and deletes both at the end.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe.skipIf(!enabled)("cover generation reserve and release against local Supabase", () => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  let service: SupabaseClient;
  let ownerId: string;
  let owner: SupabaseClient;
  let meditationId: string;

  const generations = async () => {
    const { data, error } = await service.from("meditations").select("cover_generations").eq("id", meditationId).single();
    if (error) throw error;
    return data.cover_generations as number;
  };
  const setGenerations = async (value: number) => {
    const { error } = await service.from("meditations").update({ cover_generations: value }).eq("id", meditationId);
    if (error) throw error;
  };
  const reserve = (client: SupabaseClient, id = meditationId) =>
    client.rpc("reserve_cover_generation", { p_meditation: id });
  const release = (client: SupabaseClient) => client.rpc("release_cover_generation", { p_meditation: meditationId });

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    const email = `cover-reserve-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    ownerId = data.user.id;
    owner = createClient(url, anonKey, options);
    const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const { data: med, error: insertError } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title: "Reserve", script: "Breathe.", status: "script_ready", is_public: false, settings: {} })
      .select("id")
      .single();
    if (insertError) throw insertError;
    meditationId = med.id;
  });

  afterAll(async () => {
    if (ownerId) await service.auth.admin.deleteUser(ownerId);
  });

  beforeEach(() => setGenerations(0));

  it("counts up to 3, then refuses with null", async () => {
    for (const expected of [1, 2, 3]) {
      const { data, error } = await reserve(service);
      expect(error).toBeNull();
      expect(data).toBe(expected);
    }
    const { data, error } = await reserve(service);
    expect(error).toBeNull();
    expect(data).toBeNull();
    expect(await generations()).toBe(3);
  });

  it("lets exactly one of two concurrent calls at 2 of 3 through", async () => {
    await setGenerations(2);
    const results = await Promise.all([reserve(service), reserve(service)]);
    expect(results.map((r) => r.error)).toEqual([null, null]);
    expect(results.map((r) => r.data).sort()).toEqual([3, null]);
    expect(await generations()).toBe(3);
  });

  it("holds the cap under many concurrent calls", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => reserve(service)));
    expect(results.filter((r) => r.data !== null).map((r) => r.data).sort()).toEqual([1, 2, 3]);
    expect(await generations()).toBe(3);
  });

  it("is null for a meditation that does not exist", async () => {
    const { data, error } = await reserve(service, randomUUID());
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("gives a generation back, never below 0", async () => {
    await setGenerations(2);
    expect((await release(service)).error).toBeNull();
    expect(await generations()).toBe(1);
    await setGenerations(0);
    expect((await release(service)).error).toBeNull();
    expect(await generations()).toBe(0);
  });

  it("is the service role's alone: the owner and anon can call neither", async () => {
    const anon = createClient(url, anonKey, options);
    for (const client of [owner, anon]) {
      const reserved = await reserve(client);
      expect(reserved.error?.code).toBe("42501");
      await setGenerations(1);
      const released = await release(client);
      expect(released.error?.code).toBe("42501");
    }
    expect(await generations()).toBe(1);
  });
});
