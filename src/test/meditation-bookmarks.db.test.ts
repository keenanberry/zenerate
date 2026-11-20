/**
 * Meditation bookmarks (card ZEN-7), against a real local Supabase: the
 * policies, column grants, the primary key, the embedded list query and the
 * cascades are Postgres's and PostgREST's to enforce, so only a database can
 * prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, or `supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/meditation-bookmarks.db.test.ts
 *
 * Each run makes three throwaway users and deletes them at the end; the
 * seeded accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  addBookmark,
  decodeCursor,
  getBookmarkedIds,
  listBookmarks,
  removeBookmark,
  type BookmarkPage,
} from "@/lib/meditation/bookmarks";
import { deleteOwnMeditation } from "@/lib/meditation/delete";

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const options = { auth: { autoRefreshToken: false, persistSession: false } };

describe.skipIf(!enabled)("meditation bookmarks against local Supabase", () => {
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
  let unfinishedId: string;

  async function makeUser() {
    const email = `zen7-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    users.push(data.user.id);
    return { id: data.user.id, client };
  }

  async function makeMeditation(isPublic: boolean, status = "completed", title = "ZEN-7") {
    const { data, error } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title, script: "Breathe.", status: "script_ready", is_public: false, settings: { duration: 10 } })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e } = await service
      .from("meditations")
      .update({ status, audio_path: status === "completed" ? `${ownerId}/${data.id}/r.mp3` : null, is_public: isPublic })
      .eq("id", data.id);
    if (e) throw e;
    return data.id as string;
  }

  async function rows(meditationId: string) {
    const { data, error } = await service
      .from("meditation_bookmarks")
      .select("user_id")
      .eq("meditation_id", meditationId);
    if (error) throw error;
    return data.map((r) => r.user_id).sort();
  }

  async function setPublic(id: string, isPublic: boolean) {
    const { error } = await service.from("meditations").update({ is_public: isPublic }).eq("id", id);
    if (error) throw error;
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    anon = createClient(url, anonKey, options);
    ({ id: ownerId, client: owner } = await makeUser());
    ({ id: aliceId, client: alice } = await makeUser());
    ({ id: bobId, client: bob } = await makeUser());
    publicId = await makeMeditation(true);
    privateId = await makeMeditation(false);
    unfinishedId = await makeMeditation(false, "script_ready");
  });

  afterAll(async () => {
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  describe("a listener's own bookmark", () => {
    it("is added and added again idempotently, kept to one row", async () => {
      expect(await addBookmark(alice, aliceId, publicId)).toEqual({ ok: true, value: { created: true } });
      expect(await addBookmark(alice, aliceId, publicId)).toEqual({ ok: true, value: { created: false } });
      expect(await rows(publicId)).toEqual([aliceId]);

      const { error } = await alice.from("meditation_bookmarks").insert({ meditation_id: publicId, user_id: aliceId });
      expect(error?.code).toBe("23505");
    });

    it("cannot be backdated or changed", async () => {
      const { error: insertError } = await bob
        .from("meditation_bookmarks")
        .insert({ meditation_id: publicId, user_id: bobId, created_at: "2000-01-01T00:00:00Z" });
      expect(insertError?.code).toBe("42501");

      const { error: updateError } = await alice
        .from("meditation_bookmarks")
        .update({ meditation_id: privateId })
        .eq("meditation_id", publicId)
        .eq("user_id", aliceId);
      expect(updateError?.code).toBe("42501");
    });

    it("is removed, and removing again is harmless", async () => {
      expect(await removeBookmark(alice, aliceId, publicId)).toEqual({ ok: true, value: null });
      expect(await rows(publicId)).toEqual([]);
      expect(await removeBookmark(alice, aliceId, publicId)).toEqual({ ok: true, value: null });
    });

    it("may be the owner's own public meditation, as favorites allow", async () => {
      expect(await addBookmark(owner, ownerId, publicId)).toEqual({ ok: true, value: { created: true } });
      expect(await removeBookmark(owner, ownerId, publicId)).toEqual({ ok: true, value: null });
    });
  });

  describe("refusals", () => {
    it("refuses a private, unfinished or missing meditation, through the API code and around it", async () => {
      for (const id of [privateId, unfinishedId, randomUUID(), "not-a-uuid"]) {
        expect(await addBookmark(alice, aliceId, id), id).toEqual({ ok: false, reason: "not_found" });
        expect(await removeBookmark(alice, aliceId, id), id).toEqual({ ok: false, reason: "not_found" });
      }
      const { error } = await alice.from("meditation_bookmarks").insert({ meditation_id: privateId, user_id: aliceId });
      expect(error?.code).toBe("42501");
    });

    it("refuses the owner's own private meditation", async () => {
      expect(await addBookmark(owner, ownerId, privateId)).toEqual({ ok: false, reason: "not_found" });
      const { error } = await owner.from("meditation_bookmarks").insert({ meditation_id: privateId, user_id: ownerId });
      expect(error?.code).toBe("42501");
    });

    it("refuses a bookmark written in someone else's name", async () => {
      const { error } = await alice.from("meditation_bookmarks").insert({ meditation_id: publicId, user_id: bobId });
      expect(error?.code).toBe("42501");
      expect(await rows(publicId)).toEqual([]);
    });

    it("gives signed-out visitors nothing: no rows, no writes", async () => {
      await addBookmark(alice, aliceId, publicId);
      const { error: readError } = await anon.from("meditation_bookmarks").select("user_id");
      expect(readError?.code).toBe("42501");
      const { error: writeError } = await anon.from("meditation_bookmarks").insert({ meditation_id: publicId, user_id: aliceId });
      expect(writeError?.code).toBe("42501");
      const { error: deleteError } = await anon.from("meditation_bookmarks").delete().eq("meditation_id", publicId);
      expect(deleteError?.code).toBe("42501");
      expect(await rows(publicId)).toEqual([aliceId]);
    });

    it("hides other listeners' bookmarks and refuses to remove them", async () => {
      const { data } = await bob.from("meditation_bookmarks").select("user_id, meditation_id");
      expect(data).toEqual([]);
      expect(await getBookmarkedIds(bob, aliceId, [publicId])).toEqual(new Set());
      expect((await listBookmarks(bob, aliceId)).bookmarks).toEqual([]);

      const { data: deleted } = await bob.from("meditation_bookmarks").delete().eq("user_id", aliceId).select("user_id");
      expect(deleted ?? []).toEqual([]);
      expect(await removeBookmark(bob, aliceId, publicId)).toEqual({ ok: true, value: null });
      expect(await rows(publicId)).toEqual([aliceId]);
    });
  });

  describe("the list", () => {
    it("pages the caller's visible bookmarks newest first, hiding one that went private", async () => {
      const ids = [publicId];
      for (let i = 1; i <= 4; i++) ids.push(await makeMeditation(true, "completed", `ZEN-7 #${i}`));
      for (const id of ids.slice(1)) await addBookmark(alice, aliceId, id);
      await addBookmark(bob, bobId, ids[1]);
      // Newest first: ids[4], ids[3], ids[2], ids[1], publicId (bookmarked first).
      const expected = [...ids.slice(1)].reverse().concat(publicId);

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page: BookmarkPage = await listBookmarks(alice, aliceId, {
          limit: 2,
          cursor: cursor ? decodeCursor(cursor) : null,
        });
        expect(page.bookmarks.length).toBeLessThanOrEqual(2);
        seen.push(...page.bookmarks.map((b) => b.meditation.id));
        cursor = page.next_cursor;
      } while (cursor);
      expect(seen).toEqual(expected);

      const first = (await listBookmarks(alice, aliceId, { limit: 1 })).bookmarks[0];
      expect(first.meditation).toMatchObject({
        id: ids[4],
        title: "ZEN-7 #4",
        settings: { duration: 10 },
        status: "completed",
        author: null,
        rating: null,
      });
      expect(first.bookmarked_at).toMatch(/^\d{4}-/);
      expect(first.meditation).not.toHaveProperty("script");

      // Private since: left out, not an error, and the page is still full.
      await setPublic(ids[4], false);
      const hidden = await listBookmarks(alice, aliceId, { limit: 4 });
      expect(hidden.bookmarks.map((b) => b.meditation.id)).toEqual(expected.slice(1));
      expect(hidden.next_cursor).toBeNull();
      // Still removable, and back in the list if published again.
      await setPublic(ids[4], true);
      expect((await listBookmarks(alice, aliceId)).bookmarks.map((b) => b.meditation.id)).toEqual(expected);
      await setPublic(ids[4], false);
      expect(await removeBookmark(alice, aliceId, ids[4])).toEqual({ ok: true, value: null });
      expect(await rows(ids[4])).toEqual([]);
    });

    it("pages through bookmarks that share a created_at without repeating or skipping", async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) ids.push(await makeMeditation(true, "completed", `ZEN-7 tie ${i}`));
      const at = "2026-11-20T10:00:00.123456+00:00";
      const { error } = await service
        .from("meditation_bookmarks")
        .insert(ids.map((meditation_id) => ({ user_id: ownerId, meditation_id, created_at: at })));
      if (error) throw error;

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page: BookmarkPage = await listBookmarks(owner, ownerId, { limit: 1, cursor: cursor ? decodeCursor(cursor) : null });
        seen.push(...page.bookmarks.map((b) => b.meditation.id));
        cursor = page.next_cursor;
      } while (cursor);
      expect(seen).toEqual([...ids].sort().reverse());
    });

    it("carries rating stats from getRatingStats", async () => {
      const { error } = await bob.from("meditation_ratings").insert({ meditation_id: publicId, user_id: bobId, stars: 4 });
      if (error) throw error;
      const listed = (await listBookmarks(alice, aliceId)).bookmarks.find((b) => b.meditation.id === publicId);
      expect(listed?.meditation.rating).toEqual({ average: 4, count: 1 });
    });
  });

  describe("getBookmarkedIds", () => {
    it("returns which of the ids the caller bookmarked, and nothing signed out", async () => {
      const extra = randomUUID();
      expect(await getBookmarkedIds(alice, aliceId, [publicId, privateId, extra])).toEqual(new Set([publicId]));
      expect(await getBookmarkedIds(bob, bobId, [publicId])).toEqual(new Set());
      expect(await getBookmarkedIds(anon, null, [publicId])).toEqual(new Set());
    });
  });

  it("goes with the meditation when its owner deletes it", async () => {
    expect(await rows(publicId)).toEqual([aliceId]);
    expect(await deleteOwnMeditation(owner, ownerId, publicId)).toEqual({ ok: true });
    expect(await rows(publicId)).toEqual([]);
  });
});
