/**
 * The Library's counts against a real local Supabase: a meditation that goes
 * private must leave the Favorites and Bookmarks counts exactly as it leaves
 * their lists. The `!inner` joins and RLS that do it are PostgREST's and
 * Postgres's, so only a database can prove them.
 *
 * Opt-in, since CI has no database: start Supabase, apply the migrations
 * (`supabase migration up --local`, or `supabase db reset`, LOCAL ONLY), then
 *
 *   SUPABASE_DB_TESTS=1 npx vitest run src/test/library-visibility.db.test.ts
 *
 * Each run makes two throwaway users and deletes them at the end; the seeded
 * accounts are untouched.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// The server reads go through whichever signed-in client the test sets here,
// in place of the cookie-bound one.
const { session } = vi.hoisted(() => ({ session: { client: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => session.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audio/signed-url", () => ({
  hydrateAudioUrls: async (m: unknown) => m,
  hydrateAudioUrl: async (m: unknown) => m,
}));

const { getLibraryCounts } = await import("@/lib/meditation/library");
const { getFavoriteMeditations } = await import("@/lib/meditation/actions");
const { listBookmarks } = await import("@/lib/meditation/bookmarks");

const enabled = process.env.SUPABASE_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const options = { auth: { autoRefreshToken: false, persistSession: false } };

describe.skipIf(!enabled)("the Library's counts against local Supabase", () => {
  let service: SupabaseClient;
  const users: string[] = [];
  let ownerId: string;
  let owner: SupabaseClient;
  let listenerId: string;
  let listener: SupabaseClient;
  let staysId: string;
  let goesId: string;

  async function makeUser() {
    const email = `library-${randomUUID()}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, options);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    users.push(data.user.id);
    return { id: data.user.id, client };
  }

  /** A public, completed meditation of the owner's. */
  async function makePublicMeditation(title: string) {
    const { data, error } = await owner
      .from("meditations")
      .insert({ user_id: ownerId, title, script: "Breathe.", status: "script_ready", is_public: false, settings: { duration: 10 } })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e } = await service
      .from("meditations")
      .update({ status: "completed", audio_path: `${ownerId}/${data.id}/r.mp3`, is_public: true })
      .eq("id", data.id);
    if (e) throw e;
    return data.id as string;
  }

  async function favouriteAndBookmark(id: string) {
    const { error: f } = await listener.from("favorites").insert({ user_id: listenerId, meditation_id: id });
    if (f) throw f;
    const { error: b } = await listener.from("meditation_bookmarks").insert({ user_id: listenerId, meditation_id: id });
    if (b) throw b;
  }

  beforeAll(async () => {
    service = createClient(url, serviceKey, options);
    ({ id: ownerId, client: owner } = await makeUser());
    ({ id: listenerId, client: listener } = await makeUser());
    staysId = await makePublicMeditation("Stays public");
    goesId = await makePublicMeditation("Goes private");
    await favouriteAndBookmark(staysId);
    await favouriteAndBookmark(goesId);
    session.client = listener;
  });

  afterAll(async () => {
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  it("counts both while both are public", async () => {
    const counts = await getLibraryCounts();
    expect(counts.favorites).toBe(2);
    expect(counts.bookmarks).toBe(2);
  });

  it("drops one that goes private from the counts and from both lists alike", async () => {
    const { error } = await service.from("meditations").update({ is_public: false }).eq("id", goesId);
    if (error) throw error;

    const counts = await getLibraryCounts();
    const favorites = await getFavoriteMeditations();
    const bookmarks = await listBookmarks(listener, listenerId);

    expect(favorites.map((m) => m.id)).toEqual([staysId]);
    expect(bookmarks.bookmarks.map((b) => b.meditation.id)).toEqual([staysId]);
    expect(counts.favorites).toBe(favorites.length);
    expect(counts.bookmarks).toBe(bookmarks.bookmarks.length);
  });
});
