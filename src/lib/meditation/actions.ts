"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hydrateAudioUrl, hydrateAudioUrls } from "@/lib/audio/signed-url";
import { TAGS } from "./tags";
import {
  POPULAR_MIN_SCORE,
  ROW_SIZE,
  fillRow,
  rankByTagAffinity,
  tagWeights,
  toSearchArgs,
  type DiscoverFilters,
} from "./discover";
import { removeAudio, removeMeditationAudio } from "@/lib/audio/storage";
import type {
  Meditation,
  MeditationVersion,
  MeditationWithMeta,
  Collection,
  CollectionWithCount,
} from "./types";

// ── Meditations ──

export async function createMeditation(data: {
  title: string;
  prompt: string;
  script?: string;
  status?: string;
  is_public?: boolean;
  settings?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: meditation, error } = await supabase
    .from("meditations")
    .insert({
      user_id: user.id,
      title: data.title,
      prompt: data.prompt,
      script: data.script ?? null,
      status: data.status ?? "generating_script",
      is_public: data.is_public ?? false,
      settings: data.settings ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return meditation as Meditation;
}

export async function updateMeditation(
  id: string,
  data: Partial<Pick<Meditation, "title" | "script" | "status" | "is_public" | "settings">>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meditations")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/meditation/${id}`);
}

// The owner's hand-edit of what the studio agent set through setDetails.
// Tags come only from the vocabulary; 0 is allowed here, unlike the agent's 2.
const detailsInput = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  tags: z
    .array(z.enum(TAGS))
    .max(5)
    .refine((tags) => new Set(tags).size === tags.length, "Tags must not repeat.")
    .optional(),
});

export async function updateMeditationDetails(
  id: string,
  details: { title?: string; description?: string | null; tags?: string[] }
) {
  const parsed = detailsInput.safeParse({
    ...details,
    description: details.description ?? undefined,
  });
  if (!parsed.success) throw new Error("Those details are not valid.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { title, description, tags } = parsed.data;
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) values.title = title;
  if (details.description !== undefined) values.description = description || null;
  if (tags !== undefined) values.tags = tags;

  // RLS already limits updates to the owner; the user_id filter makes the
  // intent explicit, and an empty result is how someone else's row shows up.
  const { data, error } = await supabase
    .from("meditations")
    .update(values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Meditation not found");

  revalidatePath("/dashboard");
  revalidatePath("/discover");
  revalidatePath(`/meditation/${id}`);
}

export async function deleteMeditation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Read the archived versions first: the delete cascades their rows away,
  // and storage does not cascade at all.
  const { data: versions } = await supabase
    .from("meditation_versions")
    .select("audio_path")
    .eq("meditation_id", id);
  const { data: deleted, error } = await supabase
    .from("meditations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("audio_path");
  if (error) throw new Error(error.message);

  // Only once the row is really gone, and only the caller's own folder. The
  // extra paths catch audio from before the per-user layout.
  if (deleted && deleted.length > 0) {
    try {
      await removeMeditationAudio(user.id, id, [
        deleted[0].audio_path,
        ...(versions ?? []).map((v) => v.audio_path),
      ]);
    } catch (err) {
      // The meditation is deleted either way. A file left behind sits in the
      // owner's folder, where account deletion still finds it.
      console.error(`Removing audio for deleted meditation ${id} failed:`, err);
    }
  }
  revalidatePath("/dashboard");
}

export async function getMeditation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("meditations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  const meditation = data as MeditationWithMeta;
  // A revision in progress is the owner's. The page never shows it, but the
  // row is serialized whole into the client payload, so drop it here.
  if (user?.id !== meditation.user_id) {
    meditation.draft_script = null;
  }

  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("meditation_id", id)
      .maybeSingle();
    meditation.is_favorited = !!fav;
  }

  return hydrateAudioUrl(meditation);
}

export async function getUserMeditations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("meditations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const meditations = (data ?? []) as MeditationWithMeta[];

  const { data: favs } = await supabase
    .from("favorites")
    .select("meditation_id")
    .eq("user_id", user.id);

  const favSet = new Set((favs ?? []).map((f) => f.meditation_id));
  meditations.forEach((m) => {
    m.is_favorited = favSet.has(m.id);
  });

  return hydrateAudioUrls(meditations);
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Sets is_favorited for a signed-in listener. Signed out, favorites stay unread. */
async function markFavorites(
  supabase: ServerClient,
  userId: string | undefined,
  meditations: MeditationWithMeta[],
) {
  if (!userId || meditations.length === 0) return;
  const { data: favs } = await supabase
    .from("favorites")
    .select("meditation_id")
    .eq("user_id", userId);
  const favSet = new Set((favs ?? []).map((f) => f.meditation_id));
  meditations.forEach((m) => {
    m.is_favorited = favSet.has(m.id);
  });
}

/**
 * Public, completed meditations for /discover, through `discover_meditations`
 * (migration 20261022000036): full-text search over the `search` vector,
 * ranked, plus the category, tag, type and duration filters. With no filters
 * it is the newest first.
 */
export async function getPublicMeditations(filters: DiscoverFilters = {}) {
  const supabase = await createClient();
  const [
    { data, error },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.rpc("discover_meditations", toSearchArgs(filters)),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(error.message);

  const meditations = (data ?? []) as MeditationWithMeta[];
  await markFavorites(supabase, user?.id, meditations);
  return hydrateAudioUrls(meditations);
}

/** The house picks, newest first. The fallback for both Discover rows. */
async function getFeaturedMeditations(supabase: ServerClient, excludeUserId?: string) {
  let query = supabase
    .from("meditations")
    .select("*")
    .eq("is_public", true)
    .eq("status", "completed")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(ROW_SIZE * 2);
  if (excludeUserId) query = query.neq("user_id", excludeUserId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MeditationWithMeta[];
}

/**
 * Popular: favorites plus signed-in plays, through the security definer
 * `popular_meditations`, which anon may call but which returns counts only.
 * Meditations under POPULAR_MIN_SCORE do not lead the row; the house picks
 * fill it, so it is never one lonely card.
 */
export async function getPopularMeditations() {
  const supabase = await createClient();
  const [
    { data: ranked, error },
    featured,
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.rpc("popular_meditations", { row_limit: ROW_SIZE }),
    getFeaturedMeditations(supabase),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(error.message);

  const ids = ((ranked ?? []) as { meditation_id: string; score: number }[])
    .filter((r) => r.score >= POPULAR_MIN_SCORE)
    .map((r) => r.meditation_id);

  let popular: MeditationWithMeta[] = [];
  if (ids.length > 0) {
    const { data, error: readError } = await supabase
      .from("meditations")
      .select("*")
      .in("id", ids);
    if (readError) throw new Error(readError.message);
    const order = new Map(ids.map((id, i) => [id, i]));
    popular = ((data ?? []) as MeditationWithMeta[]).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  const row = fillRow(popular, featured);
  await markFavorites(supabase, user?.id, row);
  return hydrateAudioUrls(row);
}

/**
 * Picked for you. Signed in: public meditations that share tags with the
 * listener's favorites and their own meditations, weighted by how often each
 * tag appears there, never their own. Signed out, or with no tags to go on:
 * the house picks.
 */
export async function getPickedForYou() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let picked: MeditationWithMeta[] = [];
  if (user) {
    const [{ data: own }, { data: favs }] = await Promise.all([
      supabase.from("meditations").select("tags").eq("user_id", user.id),
      supabase
        .from("favorites")
        .select("meditation:meditations(tags)")
        .eq("user_id", user.id),
    ]);
    const favoriteTags = (favs ?? [])
      .map((f) => (f as unknown as { meditation: { tags: string[] } | null }).meditation)
      .filter((m): m is { tags: string[] } => !!m);
    const weights = tagWeights([...(own ?? []), ...favoriteTags]);

    if (weights.size > 0) {
      const { data, error } = await supabase
        .from("meditations")
        .select("*")
        .eq("is_public", true)
        .eq("status", "completed")
        .neq("user_id", user.id)
        .overlaps("tags", [...weights.keys()])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      picked = rankByTagAffinity((data ?? []) as MeditationWithMeta[], weights);
    }
  }

  const featured = await getFeaturedMeditations(supabase, user?.id);
  const row = fillRow(picked, featured);
  await markFavorites(supabase, user?.id, row);
  return hydrateAudioUrls(row);
}

/**
 * One meditation_plays row for a signed-in listener whose play passed the
 * threshold (the player decides; see use-play-tracking.ts). Signed out it
 * writes nothing. RLS limits the insert to the caller's own row on a
 * meditation they can see. A failed count is never worth interrupting a
 * meditation for, so errors are swallowed.
 */
export async function recordPlay(meditationId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("meditation_plays")
    .insert({ meditation_id: meditationId, user_id: user.id });
  return !error;
}

export async function getMeditationStatus(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meditations")
    .select("status, draft_status, audio_path")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  const { audio_url } = await hydrateAudioUrl(data);
  return {
    status: data.status as string,
    /** A render of draft_script: null, "processing" or "failed". */
    draft_status: data.draft_status as "processing" | "failed" | null,
    audio_url,
  };
}

// ── Versions ──

/**
 * A meditation's archived versions, newest first, with signed audio. The
 * table is owner-only under RLS, so anyone else gets an empty list.
 */
export async function getMeditationVersions(meditationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meditation_versions")
    .select("*")
    .eq("meditation_id", meditationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return hydrateAudioUrls((data ?? []) as MeditationVersion[]);
}

/** One archived version with signed audio, or null when it is not the caller's. */
export async function getMeditationVersion(meditationId: string, versionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meditation_versions")
    .select("*")
    .eq("id", versionId)
    .eq("meditation_id", meditationId)
    .maybeSingle();

  return data ? hydrateAudioUrl(data as MeditationVersion) : null;
}

/**
 * Delete an archived version and its audio. RLS lets only the owner delete,
 * so the returned row is what proves the object is theirs to remove.
 */
export async function deleteMeditationVersion(versionId: string) {
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("meditation_versions")
    .delete()
    .eq("id", versionId)
    .select("meditation_id, audio_path");

  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) throw new Error("Version not found");

  await removeAudio([deleted[0].audio_path]);
  revalidatePath(`/meditation/${deleted[0].meditation_id}`);
}

// ── Favorites ──

export async function toggleFavorite(meditationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("meditation_id", meditationId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
  } else {
    await supabase.from("favorites").insert({
      user_id: user.id,
      meditation_id: meditationId,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/discover");
  revalidatePath(`/meditation/${meditationId}`);
  return !existing;
}

export async function getFavoriteMeditations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("meditation_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (favError || !favs?.length) return [];

  const ids = favs.map((f) => f.meditation_id);
  const { data, error } = await supabase
    .from("meditations")
    .select("*")
    .in("id", ids);

  if (error) throw new Error(error.message);

  const meditations = (data ?? []) as MeditationWithMeta[];
  meditations.forEach((m) => (m.is_favorited = true));

  const idOrder = new Map(ids.map((id, i) => [id, i]));
  meditations.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  return hydrateAudioUrls(meditations);
}

// ── Collections ──

export async function createCollection(data: {
  name: string;
  description?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      name: data.name,
      description: data.description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return collection as Collection;
}

export async function updateCollection(
  id: string,
  data: Partial<Pick<Collection, "name" | "description">>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/collections/${id}`);
}

export async function deleteCollection(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function getUserCollections() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: collections, error } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const result: CollectionWithCount[] = [];
  for (const col of collections ?? []) {
    const { count } = await supabase
      .from("collection_items")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", col.id);

    result.push({ ...col, item_count: count ?? 0 });
  }

  return result;
}

export async function getCollectionWithItems(id: string) {
  const supabase = await createClient();

  const { data: collection, error: colError } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (colError) throw new Error(colError.message);

  const { data: items, error: itemsError } = await supabase
    .from("collection_items")
    .select("*, meditation:meditations(*)")
    .eq("collection_id", id)
    .order("position", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const meditations = (items ?? [])
    .map((item) => (item as Record<string, unknown>).meditation as Meditation)
    .filter(Boolean);

  return {
    collection: collection as Collection,
    meditations: await hydrateAudioUrls(meditations),
  };
}

export async function getMeditationCollectionIds(meditationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collection_items")
    .select("collection_id")
    .eq("meditation_id", meditationId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.collection_id);
}

export async function addToCollection(
  collectionId: string,
  meditationId: string
) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("collection_items")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    meditation_id: meditationId,
    position: (count ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return; // already in collection
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/collections/${collectionId}`);
}

export async function removeFromCollection(
  collectionId: string,
  meditationId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("meditation_id", meditationId);

  if (error) throw new Error(error.message);
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/dashboard");
}
