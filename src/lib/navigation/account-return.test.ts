import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PENDING_MS,
  ACCOUNT_RETURN_KEY,
  ACCOUNT_STATE_KEY,
  canGoBack,
  isAccountPending,
  parseAccountReturn,
  readAccountReturn,
  writeAccountReturn,
} from "./account-return";

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("account return", () => {
  it("round-trips a record through storage", () => {
    const storage = memory();
    writeAccountReturn(storage, { token: "t1", pendingAt: 5 });
    expect(readAccountReturn(storage)).toEqual({ token: "t1", pendingAt: 5 });
  });

  it("ignores malformed records and a missing storage", () => {
    expect(parseAccountReturn("not json")).toBeNull();
    expect(parseAccountReturn(JSON.stringify({ token: "" }))).toBeNull();
    expect(parseAccountReturn(JSON.stringify(null))).toBeNull();
    expect(readAccountReturn(undefined)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readAccountReturn(throwing)).toBeNull();
    expect(() => writeAccountReturn(throwing, { token: "t" })).not.toThrow();
    const storage = memory();
    storage.setItem(ACCOUNT_RETURN_KEY, "{");
    expect(readAccountReturn(storage)).toBeNull();
  });

  it("is pending only for a fresh avatar click", () => {
    expect(isAccountPending({ token: "t", pendingAt: 1000 }, 1000 + ACCOUNT_PENDING_MS - 1)).toBe(true);
    expect(isAccountPending({ token: "t", pendingAt: 1000 }, 1000 + ACCOUNT_PENDING_MS)).toBe(false);
    expect(isAccountPending({ token: "t" }, 1000)).toBe(false);
    expect(isAccountPending(null, 1000)).toBe(false);
  });

  it("goes back only from the entry the click tagged", () => {
    const record = { token: "t1" };
    expect(canGoBack(record, { [ACCOUNT_STATE_KEY]: "t1", __NA: true })).toBe(true);
    expect(canGoBack(record, { [ACCOUNT_STATE_KEY]: "t0" })).toBe(false);
    expect(canGoBack(record, null)).toBe(false);
    expect(canGoBack(null, { [ACCOUNT_STATE_KEY]: "t1" })).toBe(false);
  });
});
