import { hydrateAudioUrls } from "@/lib/audio/signed-url";
import { MAX_BOOKMARK_PAGE, type BookmarkPage } from "./bookmarks";

/**
 * Signed audio for a page of bookmarks, so a bookmark row plays in place as a
 * Favorites row does. For /library/bookmarks and GET /api/bookmarks, after
 * listBookmarks has read the page through the caller's RLS-bound client.
 *
 * Not a "use server" module, so none of this is a server action a browser
 * could call with ids of its choosing. It may import the signer (see
 * eslint.config.mjs) because it signs by meditation id alone, on
 * hydrateAudioUrls' public-row path: the service role signs a meditation
 * only if it finds it public, and the path never joins the row. A bookmark
 * lists only public, completed meditations, so every listed row qualifies.
 *
 * At most MAX_BOOKMARK_PAGE ids are signed per call, the largest page
 * listBookmarks gives; any beyond that get null. Without a signed-in user
 * nothing is signed. Signing downloads nothing: the audio is fetched only
 * when a row is played.
 */
export async function signBookmarkAudioUrls(
  userId: string,
  ids: string[],
): Promise<Map<string, string | null>> {
  const urls = new Map<string, string | null>(ids.map((id) => [id, null]));
  if (!userId) return urls;
  const signable = [...urls.keys()].slice(0, MAX_BOOKMARK_PAGE);
  if (signable.length === 0) return urls;
  try {
    const signed = await hydrateAudioUrls(signable.map((id) => ({ id })));
    signed.forEach((row, i) => urls.set(signable[i], row.audio_url ?? null));
  } catch (err) {
    // A missing or stale service-role key, or Storage down. The list still
    // shows; its rows open the meditation's page to play instead.
    console.error("Could not sign bookmark audio:", err);
  }
  return urls;
}

/** The page with each meditation's audio_url set (null where it could not be signed). */
export async function withBookmarkAudio(userId: string, page: BookmarkPage): Promise<BookmarkPage> {
  const urls = await signBookmarkAudioUrls(
    userId,
    page.bookmarks.map((b) => b.meditation.id),
  );
  return {
    ...page,
    bookmarks: page.bookmarks.map((b) => ({
      ...b,
      meditation: { ...b.meditation, audio_url: urls.get(b.meditation.id) ?? null },
    })),
  };
}
