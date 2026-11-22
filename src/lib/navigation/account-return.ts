/**
 * How Account's back link knows it can go back. The avatar records a token
 * when it is clicked; Account tags its own history entry with that token on
 * mount, so the entry before it is a page of this site and `router.back()`
 * returns there. Without a matching tag (a fresh load, a new tab, a link from
 * elsewhere) the back link goes to the Library instead.
 */
export const ACCOUNT_RETURN_KEY = "zenerate:account-return";

/** The history.state key Account tags its entry with. */
export const ACCOUNT_STATE_KEY = "zenerateAccountToken";

/** How long an avatar click's record may wait for Account to mount. */
export const ACCOUNT_PENDING_MS = 10_000;

/** Where the back link goes when there is no same-site page to go back to. */
export const ACCOUNT_FALLBACK_HREF = "/library";

export interface AccountReturn {
  token: string;
  /** Set while the avatar's navigation is in flight: when it was clicked. */
  pendingAt?: number;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function parseAccountReturn(raw: string | null): AccountReturn | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.token !== "string" || !v.token) return null;
    return { token: v.token, pendingAt: typeof v.pendingAt === "number" ? v.pendingAt : undefined };
  } catch {
    return null;
  }
}

export function readAccountReturn(storage: StorageLike | undefined): AccountReturn | null {
  try {
    return parseAccountReturn(storage?.getItem(ACCOUNT_RETURN_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeAccountReturn(storage: StorageLike | undefined, value: AccountReturn): void {
  try {
    storage?.setItem(ACCOUNT_RETURN_KEY, JSON.stringify(value));
  } catch {}
}

/** Whether the record is an avatar click still waiting for Account to mount. */
export function isAccountPending(value: AccountReturn | null, now: number): value is AccountReturn {
  return !!value && value.pendingAt !== undefined && now - value.pendingAt < ACCOUNT_PENDING_MS;
}

/** Whether this history entry is the one an avatar click opened. */
export function canGoBack(value: AccountReturn | null, historyState: unknown): boolean {
  if (!value || !historyState || typeof historyState !== "object") return false;
  return (historyState as Record<string, unknown>)[ACCOUNT_STATE_KEY] === value.token;
}
