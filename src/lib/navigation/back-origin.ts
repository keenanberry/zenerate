import { safeNextPath } from "@/lib/auth/redirect";

/**
 * Where a meditation was opened from, so its parent link can return there:
 * Discover with its filters, a Library tab, or a collection. One record per
 * tab, in sessionStorage, written when a meditation link is clicked (see
 * src/components/back-origin.tsx) and read by that meditation's page.
 */
export const BACK_ORIGIN_KEY = "zenerate:back-origin";

/** How long a click's record may wait for the page it opened to mount. */
export const PENDING_MS = 10_000;

const MAX_LABEL = 80;

export interface BackOrigin {
  /** The meditation the record was made for; any other page ignores it. */
  meditationId: string;
  /** The list page's path and query, same-origin only. */
  href: string;
  label: string;
  /** Matches the history entry the click pushed, once that page has tagged it. */
  token: string;
  /** Set while the click's navigation is in flight: when it was made. */
  pendingAt?: number;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The meditation id a link points at, or null for any other link. */
export function meditationIdFromHref(href: string): string | null {
  const match = /^\/meditation\/([^/?#]+)\/?(?:[?#].*)?$/.exec(href);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The stored record, if it is well formed, same-origin and for this meditation. */
export function parseBackOrigin(raw: string | null, meditationId: string): BackOrigin | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.meditationId !== meditationId) return null;
  if (typeof v.href !== "string" || !v.href || safeNextPath(v.href, "") !== v.href) return null;
  if (typeof v.label !== "string") return null;
  const label = v.label.trim();
  if (!label || label.length > MAX_LABEL) return null;
  if (typeof v.token !== "string" || !v.token) return null;
  return {
    meditationId,
    href: v.href,
    label,
    token: v.token,
    pendingAt: typeof v.pendingAt === "number" ? v.pendingAt : undefined,
  };
}

/** Where the parent link goes: the record, or the owner/Discover rule without one. */
export function backTarget(
  origin: BackOrigin | null,
  isOwner: boolean,
): { href: string; label: string } {
  if (origin) return { href: origin.href, label: origin.label };
  // The owner came from their library; everyone else, including a signed-in
  // visitor on a shared link, belongs to Discover.
  return isOwner
    ? { href: "/dashboard", label: "Library" }
    : { href: "/discover", label: "Discover" };
}

/** True while a click's record still waits for the page it opened. */
export function isPending(origin: BackOrigin, now: number): boolean {
  return origin.pendingAt !== undefined && now - origin.pendingAt < PENDING_MS;
}

export function readRaw(storage: StorageLike | undefined): string | null {
  try {
    return storage?.getItem(BACK_ORIGIN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeOrigin(storage: StorageLike | undefined, origin: BackOrigin | null) {
  try {
    if (origin) storage?.setItem(BACK_ORIGIN_KEY, JSON.stringify(origin));
    else storage?.removeItem(BACK_ORIGIN_KEY);
  } catch {}
}

/**
 * The record a click on `linkHref` leaves behind, or null to clear it. A
 * meditation opened from anywhere without a label (the landing page, the
 * studio) clears the record, so an older one cannot resurface.
 */
export function originForClick({
  linkHref,
  from,
  label,
  plain,
  now,
  token,
}: {
  linkHref: string;
  /** The current page's path and query. */
  from: string;
  label: string | null;
  /** A plain left click in this tab; a new tab has no history to go back to. */
  plain: boolean;
  now: number;
  token: string;
}): BackOrigin | null | undefined {
  const meditationId = meditationIdFromHref(linkHref);
  if (!meditationId) return undefined; // not a meditation link: leave it alone
  if (!label?.trim()) return null;
  return {
    meditationId,
    href: from,
    label: label.trim(),
    token,
    pendingAt: plain ? now : undefined,
  };
}
