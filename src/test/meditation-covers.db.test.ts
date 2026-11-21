/**
 * Generated meditation covers: the column, its grants and the bucket
 * (20261121010000_meditation_covers.sql,
 * docs/superpowers/specs/2026-11-21-generated-cover-art-design.md),
 * against a real local Supabase. Column grants, function return lists and
 * storage policies are Postgres's and Storage's to enforce, and the anon
 * grant is the kind of thing only production catches (CLAUDE.md), so only a
 * running stack can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, or `supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/meditation-covers.db.test.ts
 *
 * Each run makes one throwaway user with a public meditation and deletes
 * both, and the cover objects, at the end; the seeded accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { COVER_BUCKET } from "@/lib/cover/url";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// The smallest valid WebP (a 1×1 lossless image); the bucket checks the
// declared type and size, not the pixels.
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
const webp = () => new Blob([WEBP], { type: "image/webp" });

describe.skipIf(!enabled)("meditation covers against local Supabase", () => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let ownerId: string;
  let owner: SupabaseClient;
  let meditationId: string;
  let coverPath: string;

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);

    const email = `covers-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    ownerId = data.user.id;
    owner = createClient(url, anonKey, options);
    const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    // A public, completed meditation with a cover, as the studio tool will leave one.
    const { data: med, error: insertError } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title: "Covers", script: "Breathe.", status: "script_ready", is_public: false, settings: {} })
      .select("id")
      .single();
    if (insertError) throw insertError;
    meditationId = med.id;
    coverPath = `${meditationId}/${randomUUID()}.webp`;

    const { error: uploadError } = await service.storage
      .from(COVER_BUCKET)
      .upload(coverPath, webp(), { contentType: "image/webp" });
    if (uploadError) throw uploadError;
    const { error: serviceError } = await service
      .from("meditations")
      .update({ status: "completed", audio_path: `${ownerId}/${meditationId}/r.mp3`, cover_path: coverPath })
      .eq("id", meditationId);
    if (serviceError) throw serviceError;
    const { error: publishError } = await owner.from("meditations").update({ is_public: true }).eq("id", meditationId);
    if (publishError) throw publishError;
  });

  afterAll(async () => {
    if (meditationId) {
      const { data } = await service.storage.from(COVER_BUCKET).list(meditationId);
      if (data?.length) {
        await service.storage.from(COVER_BUCKET).remove(data.map((o) => `${meditationId}/${o.name}`));
      }
    }
    if (ownerId) await service.auth.admin.deleteUser(ownerId);
  });

  it("is a public bucket of WebP, JPEG or PNG, 2 MB at most", async () => {
    const { data, error } = await service.storage.getBucket(COVER_BUCKET);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      public: true,
      file_size_limit: 2 * 1024 * 1024,
      allowed_mime_types: ["image/webp", "image/jpeg", "image/png"],
    });
  });

  describe("signed out", () => {
    it("reads a public meditation's cover_path straight from the table", async () => {
      const { data, error } = await anon.from("meditations").select("id, cover_path").eq("id", meditationId).single();
      expect(error).toBeNull();
      expect(data).toEqual({ id: meditationId, cover_path: coverPath });
    });

    it("gets cover_path from discover_meditations", async () => {
      const { data, error } = await anon.rpc("discover_meditations", {});
      expect(error).toBeNull();
      const row = (data as { id: string; cover_path?: string | null }[]).find((m) => m.id === meditationId);
      expect(row?.cover_path).toBe(coverPath);
    });

    it("cannot read cover_generations", async () => {
      const { error } = await anon.from("meditations").select("cover_generations").eq("id", meditationId);
      expect(error?.code).toBe("42501");
    });

    it("can fetch the cover by its public URL", async () => {
      const response = await fetch(`${url}/storage/v1/object/public/${COVER_BUCKET}/${coverPath}`);
      expect(response.status).toBe(200);
      await response.arrayBuffer();
    });
  });

  describe("the owner", () => {
    it("gets cover_path from profile_meditations", async () => {
      // The owner's own profile, private as it is, previews its public meditations.
      const { data, error } = await owner.rpc("profile_meditations", { p_profile_id: ownerId });
      expect(error).toBeNull();
      const row = (data as { id: string; cover_path?: string | null }[]).find((m) => m.id === meditationId);
      expect(row?.cover_path).toBe(coverPath);
    });

    it("cannot point cover_path anywhere with a direct PATCH", async () => {
      const { error } = await owner
        .from("meditations")
        .update({ cover_path: `${randomUUID()}/someone-else.webp` })
        .eq("id", meditationId);
      expect(error?.code).toBe("42501");
      const { data } = await service.from("meditations").select("cover_path").eq("id", meditationId).single();
      expect(data!.cover_path).toBe(coverPath);
    });

    it("cannot reset cover_generations with a direct PATCH", async () => {
      await service.from("meditations").update({ cover_generations: 3 }).eq("id", meditationId);
      const { error } = await owner.from("meditations").update({ cover_generations: 0 }).eq("id", meditationId);
      expect(error?.code).toBe("42501");
      const { data } = await service.from("meditations").select("cover_generations").eq("id", meditationId).single();
      expect(data!.cover_generations).toBe(3);
    });

    it("cannot be born with a cover", async () => {
      const { error } = await owner
        .from("meditations")
        .insert({ user_id: ownerId, title: "Forged", status: "script_ready", is_public: false, settings: {}, cover_path: coverPath });
      expect(error?.code).toBe("42501");
    });

    it("cannot upload, overwrite or delete a cover object", async () => {
      const { error: uploadError } = await owner.storage
        .from(COVER_BUCKET)
        .upload(`${meditationId}/${randomUUID()}.webp`, webp(), { contentType: "image/webp" });
      expect(uploadError).not.toBeNull();

      await owner.storage.from(COVER_BUCKET).remove([coverPath]);
      const { data } = await service.storage.from(COVER_BUCKET).list(meditationId);
      expect(data!.map((o) => `${meditationId}/${o.name}`)).toEqual([coverPath]);
    });
  });

  it("keeps cover_generations between 0 and 3", async () => {
    const { error } = await service.from("meditations").update({ cover_generations: 4 }).eq("id", meditationId);
    expect(error?.code).toBe("23514");
  });
});
