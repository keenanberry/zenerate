/**
 * The app's three jobs, as the bottom tab bar (below `md`) and the app-shell
 * top bar (from `md`) name them. Icons are chosen by the components.
 */
export type AppTab = "library" | "discover" | "create";

export const APP_TABS: readonly { id: AppTab; href: string; label: string }[] = [
  { id: "library", href: "/library", label: "Library" },
  { id: "discover", href: "/discover", label: "Discover" },
  { id: "create", href: "/create", label: "Create" },
];

/** Whether `pathname` is `base` or a page under it. */
function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The tab a page belongs to. A collection is part of the Library; Account
 * and a meditation (which may be anyone's) belong to no tab.
 */
export function activeTab(pathname: string): AppTab | null {
  if (within(pathname, "/library") || within(pathname, "/collections")) return "library";
  if (within(pathname, "/discover")) return "discover";
  if (within(pathname, "/create")) return "create";
  return null;
}

/**
 * Whether the bottom bar renders. The studio (`/create/<chatId>`) pins its
 * composer to the bottom of the screen, so the bar stays out of it.
 */
export function showBottomBar(pathname: string): boolean {
  return !pathname.startsWith("/create/");
}

/**
 * Up to two letters for the account avatar: the first letters of the first
 * and last words of the display name, else the email's first letter, else "?".
 */
export function initials(displayName: string | null, email: string | null): string {
  const words = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  const letter = (email ?? "").trim()[0];
  return letter ? letter.toUpperCase() : "?";
}
