/**
 * Owner deletion of meditations and chats (card ZEN-4), against a real local
 * Supabase: RLS and foreign keys are Postgres's to enforce, so only a
 * database can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase db reset`, LOCAL ONLY, or `supabase migration up --local`), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/owner-delete.db.test.ts
 *
 * Each run makes two throwaway users and deletes them at the end; the seeded
 * accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { deleteOwnMeditation } from "@/lib/meditation/delete";
import { deleteOwnChat } from "@/lib/chat/delete";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const options = { auth: { autoRefreshToken: false, persistSession: false } };

describe.skipIf(!enabled)("owner deletion against local Supabase", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const users: { id: string; client: SupabaseClient }[] = [];
  let ownerId: string;
  let owner: SupabaseClient;
  let otherId: string;
  let other: SupabaseClient;
  let meditationId: string;
  let chatId: string;
  let ledgerId: string;

  async function makeUser() {
    const email = `zen4-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    users.push({ id: data.user.id, client });
    return { id: data.user.id, client };
  }

  async function count(table: string, column: string, value: string) {
    const { count, error } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw error;
    return count;
  }

  async function onDiscover(client: SupabaseClient) {
    const { data, error } = await client.rpc("discover_meditations", {});
    if (error) throw error;
    return (data as { id: string }[]).some((m) => m.id === meditationId);
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);
    ({ id: ownerId, client: owner } = await makeUser());
    ({ id: otherId, client: other } = await makeUser());

    // A public meditation with everything that hangs off one.
    const { data: med, error } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title: "ZEN-4", script: "Breathe.", status: "script_ready", is_public: false, settings: {} })
      .select("id")
      .single();
    if (error) throw error;
    meditationId = med.id;
    await service
      .from("meditations")
      .update({ status: "completed", audio_path: `${ownerId}/${meditationId}/r.mp3` })
      .eq("id", meditationId);
    await owner.from("meditations").update({ is_public: true }).eq("id", meditationId);

    const inserts = await Promise.all([
      service.from("meditation_versions").insert({ meditation_id: meditationId, script: "Old.", audio_path: `${ownerId}/${meditationId}/old.mp3` }),
      service.from("meditation_drafts").insert({ meditation_id: meditationId, script: "Next.", render_status: "failed" }),
      other.from("meditation_plays").insert({ meditation_id: meditationId, user_id: otherId }),
      other.from("favorites").insert({ meditation_id: meditationId, user_id: otherId }),
      other.from("meditation_ratings").insert({ meditation_id: meditationId, user_id: otherId, stars: 4 }),
    ]);
    for (const { error: e } of inserts) if (e) throw e;

    const { data: collection } = await other.from("collections").insert({ user_id: otherId, name: "Keep" }).select("id").single();
    const { error: itemError } = await other
      .from("collection_items")
      .insert({ collection_id: collection!.id, meditation_id: meditationId });
    if (itemError) throw itemError;

    const { data: ledger, error: ledgerError } = await service
      .from("audio_generation_events")
      .insert({ user_id: ownerId, meditation_id: meditationId, status: "completed" })
      .select("id")
      .single();
    if (ledgerError) throw ledgerError;
    ledgerId = ledger.id;

    const { data: chat, error: chatError } = await owner
      .from("chats")
      .insert({ user_id: ownerId, meditation_id: meditationId, title: "ZEN-4 chat" })
      .select("id")
      .single();
    if (chatError) throw chatError;
    chatId = chat.id;
    const { error: messageError } = await service
      .from("chat_messages")
      .insert({ id: `msg-${randomUUID()}`, chat_id: chatId, role: "user", parts: [{ type: "text", text: "hi" }] });
    if (messageError) throw messageError;
  });

  afterAll(async () => {
    for (const { id } of users) await service.auth.admin.deleteUser(id);
  });

  describe("someone other than the owner", () => {
    it("cannot delete the meditation, public as it is", async () => {
      expect(await deleteOwnMeditation(other, otherId, meditationId)).toEqual({ ok: false, reason: "not_found" });
      // Straight through PostgREST, skipping the user_id filter: RLS still says no.
      const { data } = await other.from("meditations").delete().eq("id", meditationId).select("id");
      expect(data ?? []).toHaveLength(0);
      expect(await count("meditations", "id", meditationId)).toBe(1);
    });

    it("cannot delete the meditation signed out", async () => {
      const { data } = await anon.from("meditations").delete().eq("id", meditationId).select("id");
      expect(data ?? []).toHaveLength(0);
      expect(await count("meditations", "id", meditationId)).toBe(1);
    });

    it("cannot delete the chat, signed in or out", async () => {
      expect(await deleteOwnChat(other, otherId, chatId)).toEqual({ ok: false, reason: "not_found" });
      const { data } = await other.from("chats").delete().eq("id", chatId).select("id");
      expect(data ?? []).toHaveLength(0);
      const { data: anonData } = await anon.from("chats").delete().eq("id", chatId).select("id");
      expect(anonData ?? []).toHaveLength(0);
      expect(await count("chats", "id", chatId)).toBe(1);
      expect(await count("chat_messages", "chat_id", chatId)).toBe(1);
    });
  });

  describe("the owner", () => {
    it("deletes the meditation: gone from Discover, its dependents with it", async () => {
      expect(await onDiscover(anon)).toBe(true);

      expect(await deleteOwnMeditation(owner, ownerId, meditationId)).toEqual({ ok: true });

      expect(await count("meditations", "id", meditationId)).toBe(0);
      expect(await onDiscover(anon)).toBe(false);
      expect(await onDiscover(other)).toBe(false);
      for (const table of ["meditation_versions", "meditation_drafts", "meditation_plays", "favorites", "collection_items", "meditation_ratings"]) {
        expect(await count(table, "meditation_id", meditationId), table).toBe(0);
      }
    });

    it("keeps the chat it was made in, unlinked, so it can make it again", async () => {
      const { data } = await service.from("chats").select("meditation_id").eq("id", chatId).single();
      expect(data!.meditation_id).toBeNull();
    });

    it("keeps the audio ledger row the monthly cap counts", async () => {
      const { data } = await service.from("audio_generation_events").select("user_id, meditation_id").eq("id", ledgerId).single();
      expect(data).toEqual({ user_id: ownerId, meditation_id: null });
    });

    it("deletes the chat and its messages", async () => {
      expect(await deleteOwnChat(owner, ownerId, chatId)).toEqual({ ok: true });
      expect(await count("chats", "id", chatId)).toBe(0);
      expect(await count("chat_messages", "chat_id", chatId)).toBe(0);
    });
  });
});
