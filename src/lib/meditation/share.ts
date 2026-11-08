/**
 * The Share item on a public meditation (task 59). The installed iPhone app
 * runs standalone, with no Safari toolbar or address bar, so this is the only
 * way to share from it. The URL is built from the site URL rather than
 * window.location, so a share from a preview or a stray query string still
 * hands out the canonical page.
 */
export type SharePayload = { title: string; text: string; url: string };

export function sharePayload(
  meditation: { id: string; title: string },
  siteUrl: URL | string,
): SharePayload {
  return {
    title: meditation.title,
    text: `${meditation.title}, a meditation on Zenerate`,
    url: new URL(`/meditation/${meditation.id}`, siteUrl).href,
  };
}

/** What happened, so the caller knows whether to confirm a copy. */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

type ShareNavigator = Pick<Navigator, "share" | "canShare" | "clipboard">;

/**
 * The native share sheet where the browser has one and accepts the payload,
 * otherwise the URL on the clipboard. A cancelled sheet is not an error.
 */
export async function shareMeditation(
  payload: SharePayload,
  nav: Partial<ShareNavigator> = navigator,
): Promise<ShareOutcome> {
  if (typeof nav.share === "function" && (!nav.canShare || nav.canShare(payload))) {
    try {
      await nav.share(payload);
      return "shared";
    } catch (error) {
      // By name, not instanceof: a DOMException is not an Error everywhere.
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // Anything else (a NotAllowedError outside a gesture, say) falls
      // through to the clipboard, so the person still gets the link.
    }
  }
  try {
    await nav.clipboard!.writeText(payload.url);
    return "copied";
  } catch {
    return "failed";
  }
}
