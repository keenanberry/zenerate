import {
  DISCOVER_CATEGORIES,
  MEDITATION_TYPES,
  isTag,
  type DiscoverCategory,
  type MeditationType,
  type Tag,
} from "./tags";

/**
 * /discover's filter state, read from the URL so a search or a category is a
 * link someone can share. Everything is optional; an empty object is the
 * browse view (categories and rows).
 */
export type DiscoverFilters = {
  q?: string;
  category?: string;
  tag?: Tag;
  type?: MeditationType;
  duration?: DurationBucket["slug"];
};

/**
 * Duration buckets, in whole minutes of `settings.duration` (the target the
 * agent wrote to). Each bucket owns the minutes nearest its label, so every
 * length lands in exactly one.
 */
export const DURATION_BUCKETS = [
  { slug: "5", label: "5 min", min: null, max: 7 },
  { slug: "10", label: "10 min", min: 8, max: 12 },
  { slug: "15", label: "15 min", min: 13, max: 17 },
  { slug: "20", label: "20+ min", min: 18, max: null },
] as const;

export type DurationBucket = (typeof DURATION_BUCKETS)[number];

export const TYPE_LABELS: Record<MeditationType, string> = {
  guided: "Guided",
  "body-scan": "Body scan",
  breathwork: "Breathwork",
  "loving-kindness": "Loving-kindness",
  visualization: "Visualization",
  mindfulness: "Mindfulness",
  sleep: "Sleep",
  manifestation: "Manifestation",
  mantra: "Mantra",
};

/** How many cards a Popular or Picked for you row holds. */
export const ROW_SIZE = 8;

/**
 * The score (favorites + plays, owner excluded) a meditation needs before
 * Popular ranks it ahead of the house picks. One favorite from a friend is
 * not popularity; two independent signals is the least that reads as it.
 */
export const POPULAR_MIN_SCORE = 2;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

/** Reads the URL, dropping anything outside the vocabulary. */
export function parseDiscoverFilters(params: SearchParams): DiscoverFilters {
  const filters: DiscoverFilters = {};
  const q = first(params.q);
  if (q) filters.q = q.slice(0, 200);
  const category = first(params.category);
  if (category && getCategory(category)) filters.category = category;
  const tag = first(params.tag);
  if (tag && isTag(tag)) filters.tag = tag;
  const type = first(params.type);
  if (type && (MEDITATION_TYPES as readonly string[]).includes(type)) {
    filters.type = type as MeditationType;
  }
  const duration = first(params.duration);
  const bucket = DURATION_BUCKETS.find((b) => b.slug === duration);
  if (bucket) filters.duration = bucket.slug;
  return filters;
}

export function hasActiveFilters(filters: DiscoverFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export function getCategory(slug: string): DiscoverCategory | undefined {
  return DISCOVER_CATEGORIES.find((c) => c.slug === slug);
}

/** The arguments to `discover_meditations`, nulls for "any". */
export function toSearchArgs(filters: DiscoverFilters, rowLimit = 50) {
  const bucket = DURATION_BUCKETS.find((b) => b.slug === filters.duration);
  const category = filters.category ? getCategory(filters.category) : undefined;
  return {
    q: filters.q ?? null,
    any_tags: category?.tags ?? null,
    tag: filters.tag ?? null,
    meditation_type: filters.type ?? null,
    min_minutes: bucket?.min ?? null,
    max_minutes: bucket?.max ?? null,
    row_limit: rowLimit,
  };
}

/**
 * The /discover URL for `filters` with `patch` applied. A key patched to
 * undefined is removed. Keys keep a fixed order so equal states are equal
 * links.
 */
export function discoverHref(
  filters: DiscoverFilters,
  patch: Partial<Record<keyof DiscoverFilters, string | undefined>> = {},
): string {
  const next: Record<string, string | undefined> = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const key of ["q", "category", "tag", "type", "duration"] as const) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}

/** The search field, and the query it has sent that the URL has yet to reach. */
export type SearchField = { text: string; awaiting: string | null };

/**
 * The search field once the URL's query changes. While a typed query is on its
 * way, an older one can land first (typing went on during the server render);
 * copying it in would wipe what was typed since, so the field waits for its
 * own. Any other change (a category card, "Clear all", the back button) is
 * followed.
 */
export function followUrlQuery(field: SearchField, urlQuery: string | undefined): SearchField {
  const q = urlQuery ?? "";
  if (field.awaiting !== null) {
    return q === field.awaiting ? { text: field.text, awaiting: null } : field;
  }
  return q === field.text.trim() ? field : { text: q, awaiting: null };
}

/**
 * `primary` first, then `fallback`, without repeats, up to `size`. This is
 * how a row stays full before real counts exist: Popular and Picked for you
 * lead with what they found and pad with the house picks.
 */
export function fillRow<T extends { id: string }>(
  primary: T[],
  fallback: T[],
  size = ROW_SIZE,
): T[] {
  const seen = new Set<string>();
  const row: T[] = [];
  for (const item of [...primary, ...fallback]) {
    if (row.length >= size) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    row.push(item);
  }
  return row;
}

/** Counts each tag across the meditations a listener has favorited or made. */
export function tagWeights(sources: { tags: string[] | null }[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const source of sources) {
    for (const tag of source.tags ?? []) {
      weights.set(tag, (weights.get(tag) ?? 0) + 1);
    }
  }
  return weights;
}

/**
 * Orders candidates by how much their tags overlap the listener's weights,
 * dropping any with no overlap. Ties keep the incoming order (newest first).
 */
export function rankByTagAffinity<T extends { tags: string[] | null }>(
  candidates: T[],
  weights: Map<string, number>,
): T[] {
  return candidates
    .map((item, index) => ({
      item,
      index,
      score: (item.tags ?? []).reduce((sum, t) => sum + (weights.get(t) ?? 0), 0),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((c) => c.item);
}
