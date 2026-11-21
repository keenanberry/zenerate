/**
 * The avatars bucket and its storage policies (20261121000000_avatars_bucket.sql),
 * against a real local Supabase: Storage enforces the bucket limits and
 * Postgres the RLS on storage.objects, so only a running stack can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, or `supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/avatars-storage.db.test.ts
 *
 * Each run makes two throwaway users and deletes them and their objects at
 * the end; the seeded accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { AVATAR_BUCKET, avatarPath, avatarPublicBase } from "@/lib/profile/avatar";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// The smallest valid WebP (a 1×1 lossless image); the bucket checks the
// declared type and size, not the pixels.
const WEBP = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
  "base64",
);
const webp = () => new Blob([WEBP], { type: "image/webp" });

describe.skipIf(!enabled)("avatars bucket against local Supabase", () => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let alice: { id: string; client: SupabaseClient };
  let bob: { id: string; client: SupabaseClient };

  async function makeUser(label: string) {
    const email = `avatars-${label}-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { id: data.user.id, client };
  }

  async function exists(path: string) {
    const [folder, name] = path.split("/");
    const { data, error } = await service.storage.from(AVATAR_BUCKET).list(folder, { search: name });
    if (error) throw error;
    return data.some((o) => o.name === name);
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);
    alice = await makeUser("alice");
    bob = await makeUser("bob");
  });

  afterAll(async () => {
    for (const user of [alice, bob]) {
      if (!user) continue;
      const { data } = await service.storage.from(AVATAR_BUCKET).list(user.id);
      if (data?.length) {
        await service.storage.from(AVATAR_BUCKET).remove(data.map((o) => `${user.id}/${o.name}`));
      }
      await service.auth.admin.deleteUser(user.id);
    }
  });

  it("is public, WebP or JPEG, 1 MB", async () => {
    const { data, error } = await service.storage.getBucket(AVATAR_BUCKET);
    expect(error).toBeNull();
    expect(data).toMatchObject({ public: true, file_size_limit: 1048576, allowed_mime_types: ["image/webp", "image/jpeg"] });
  });

  it("a user uploads to their own folder, and anyone can fetch it by its public URL", async () => {
    const path = avatarPath(alice.id, randomUUID());
    const { error } = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(path, webp(), { contentType: "image/webp" });
    expect(error).toBeNull();
    expect(await exists(path)).toBe(true);

    const { data } = anon.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    expect(data.publicUrl).toBe(`${avatarPublicBase(url)}${path}`);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
  });

  it("a JPEG (Safari's fallback) uploads too", async () => {
    const path = avatarPath(alice.id, randomUUID(), "image/jpeg");
    const { error } = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(path, new Blob([WEBP], { type: "image/jpeg" }), { contentType: "image/jpeg" });
    expect(error).toBeNull();
    expect(await exists(path)).toBe(true);
  });

  it("cannot upload to another user's folder", async () => {
    const path = avatarPath(bob.id, randomUUID());
    const { error } = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(path, webp(), { contentType: "image/webp" });
    expect(error).not.toBeNull();
    expect(await exists(path)).toBe(false);
  });

  it("cannot upload into a nested folder, even under their own", async () => {
    const path = `${alice.id}/nested/${randomUUID()}.webp`;
    const { error } = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(path, webp(), { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("signed out, cannot upload at all", async () => {
    const path = avatarPath(alice.id, randomUUID());
    const { error } = await anon.storage
      .from(AVATAR_BUCKET)
      .upload(path, webp(), { contentType: "image/webp" });
    expect(error).not.toBeNull();
    expect(await exists(path)).toBe(false);
  });

  it("refuses a type other than WebP or JPEG, and a file over 1 MB", async () => {
    const png = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(`${alice.id}/${randomUUID()}.png`, new Blob([WEBP], { type: "image/png" }), {
        contentType: "image/png",
      });
    expect(png.error).not.toBeNull();

    const big = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath(alice.id, randomUUID()), new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(big.error).not.toBeNull();
  });

  it("cannot delete or overwrite another user's object", async () => {
    const path = avatarPath(bob.id, randomUUID());
    const up = await bob.client.storage.from(AVATAR_BUCKET).upload(path, webp(), { contentType: "image/webp" });
    expect(up.error).toBeNull();

    // RLS hides the row, so Storage reports nothing removed rather than an error.
    const { data } = await alice.client.storage.from(AVATAR_BUCKET).remove([path]);
    expect(data ?? []).toEqual([]);
    expect(await exists(path)).toBe(true);

    const overwrite = await alice.client.storage
      .from(AVATAR_BUCKET)
      .upload(path, webp(), { contentType: "image/webp", upsert: true });
    expect(overwrite.error).not.toBeNull();
  });

  it("cannot list another user's folder, and signed out cannot list at all", async () => {
    const path = avatarPath(bob.id, randomUUID());
    await bob.client.storage.from(AVATAR_BUCKET).upload(path, webp(), { contentType: "image/webp" });

    const asAlice = await alice.client.storage.from(AVATAR_BUCKET).list(bob.id);
    expect(asAlice.data ?? []).toEqual([]);
    const asAnon = await anon.storage.from(AVATAR_BUCKET).list(bob.id);
    expect(asAnon.data ?? []).toEqual([]);
  });

  it("a user deletes their own object", async () => {
    const path = avatarPath(alice.id, randomUUID());
    await alice.client.storage.from(AVATAR_BUCKET).upload(path, webp(), { contentType: "image/webp" });
    const { data, error } = await alice.client.storage.from(AVATAR_BUCKET).remove([path]);
    expect(error).toBeNull();
    expect(data?.map((o) => o.name)).toEqual([path]);
    expect(await exists(path)).toBe(false);
  });
});
