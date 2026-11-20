/**
 * The bookmark ("save for later") control's decisions and its shared state
 * (card ZEN-8), kept free of React so they can be unit-tested. The backend
 * is card ZEN-7: PUT and DELETE /api/meditations/[id]/bookmark.
 *
 * A bookmark changed in this tab is remembered here by meditation id, so
 * every control for the same meditation agrees: the same one can sit in
 * Discover's Popular and Picked for you rows at once, and a page the router
 * kept from before the change would otherwise show the old state.
 */

/** Only a public, finished meditation can be bookmarked (the insert policy's rule). */
export function canBookmark(m: { is_public?: boolean | null; status?: string | null }): boolean {
  return m.is_public === true && m.status === "completed";
}

/** The tooltip, short as the heart's. */
export function bookmarkTooltip(isBookmarked: boolean): string {
  return isBookmarked ? "Saved" : "Save for later";
}

/** The control's accessible name, with the meditation's title where there is one. */
export function bookmarkLabel(isBookmarked: boolean, title?: string): string {
  if (!title) return isBookmarked ? "Remove from saved" : "Save for later";
  return isBookmarked ? `Remove ${title} from saved` : `Save ${title} for later`;
}

/** Where a signed-out tap goes: sign in, then back to the page it came from. */
export function signInHref(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

/**
 * The /account list's page size: the server renders the first page and each
 * "Load more" asks for as many. Here rather than in the client component: a
 * server component importing a value from a "use client" module gets a
 * client reference, not the value.
 */
export const ACCOUNT_BOOKMARK_PAGE = 20;

export type BookmarkResult = "ok" | "signed_out" | "error";

/**
 * Saves (PUT) or removes (DELETE) the caller's bookmark. Both are idempotent,
 * so a repeated tap is harmless. A 401 means the session ended since the page
 * loaded; anything else that is not 2xx (a 404 for a meditation that went
 * private, a network failure) is an error the caller rolls back.
 */
export async function setBookmark(
  meditationId: string,
  bookmarked: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<BookmarkResult> {
  try {
    const res = await fetchImpl(`/api/meditations/${encodeURIComponent(meditationId)}/bookmark`, {
      method: bookmarked ? "PUT" : "DELETE",
    });
    if (res.ok) return "ok";
    return res.status === 401 ? "signed_out" : "error";
  } catch {
    return "error";
  }
}

// ── Shared state ────────────────────────────────────────────────────────────

const changed = new Map<string, boolean>();
const listeners = new Set<() => void>();

/** What this tab last set for the meditation, or undefined if it has not. */
export function bookmarkOverride(meditationId: string): boolean | undefined {
  return changed.get(meditationId);
}

export function setBookmarkOverride(meditationId: string, bookmarked: boolean): void {
  if (changed.get(meditationId) === bookmarked) return;
  changed.set(meditationId, bookmarked);
  listeners.forEach((listener) => listener());
}

export function subscribeBookmarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests. */
export function resetBookmarkOverrides(): void {
  changed.clear();
}
