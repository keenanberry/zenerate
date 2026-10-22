"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hydrateAudioUrl, hydrateAudioUrls } from "@/lib/audio/signed-url";
import { TAGS } from "./tags";
import type {
  Meditation,
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
  const { error } = await supabase.from("meditations").delete().eq("id", id);
  if (error) throw new Error(error.message);
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

export async function getPublicMeditations(search?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("meditations")
    .select("*")
    .eq("is_public", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const meditations = (data ?? []) as MeditationWithMeta[];

  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("meditation_id")
      .eq("user_id", user.id);

    const favSet = new Set((favs ?? []).map((f) => f.meditation_id));
    meditations.forEach((m) => {
      m.is_favorited = favSet.has(m.id);
    });
  }

  return hydrateAudioUrls(meditations);
}


export async function getMeditationStatus(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meditations")
    .select("status, audio_path")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  const { audio_url } = await hydrateAudioUrl(data);
  return {
    status: data.status as string,
    audio_url,
  };
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
