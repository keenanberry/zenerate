import { describe, expect, it } from "vitest";
import {
  BACK_ORIGIN_KEY,
  PENDING_MS,
  backTarget,
  isPending,
  meditationIdFromHref,
  originForClick,
  parseBackOrigin,
  readRaw,
  writeOrigin,
  type BackOrigin,
  type StorageLike,
} from "./back-origin";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

function click(linkHref: string, from: string, label: string | null, plain = true) {
  return originForClick({ linkHref, from, label, plain, now: 1000, token: "t1" });
}

/** A click, stored and read back by the page it opened, as the components do. */
function roundTrip(storage: StorageLike, ...clicks: Parameters<typeof click>[]) {
  for (const args of clicks) {
    const origin = click(...args);
    if (origin !== undefined) writeOrigin(storage, origin);
  }
  return (id: string, isOwner = false) =>
    backTarget(parseBackOrigin(readRaw(storage), id), isOwner);
}

describe("meditationIdFromHref", () => {
  it("reads the id from a meditation link", () => {
    expect(meditationIdFromHref("/meditation/abc")).toBe("abc");
    expect(meditationIdFromHref("/meditation/abc?x=1")).toBe("abc");
    expect(meditationIdFromHref("/meditation/abc/")).toBe("abc");
  });

  it("ignores every other link", () => {
    expect(meditationIdFromHref("/discover")).toBeNull();
    expect(meditationIdFromHref("/meditation/")).toBeNull();
    expect(meditationIdFromHref("/meditation/abc/edit")).toBeNull();
    expect(meditationIdFromHref("/collections/abc")).toBeNull();
  });
});

describe("originForClick", () => {
  it("records the list page's exact URL and label", () => {
    expect(click("/meditation/a", "/discover?q=sleep&duration=short", "Discover")).toEqual({
      meditationId: "a",
      href: "/discover?q=sleep&duration=short",
      label: "Discover",
      token: "t1",
      pendingAt: 1000,
    });
  });

  it("marks only a plain click as pending, since a new tab has no history", () => {
    expect(click("/meditation/a", "/discover", "Discover", false)?.pendingAt).toBeUndefined();
  });

  it("clears the record for a meditation opened from an unlabelled page", () => {
    expect(click("/meditation/a", "/", null)).toBeNull();
    expect(click("/meditation/a", "/create", "  ")).toBeNull();
  });

  it("leaves the record alone for a link that is not a meditation", () => {
    expect(click("/discover?category=sleep", "/discover", "Discover")).toBeUndefined();
  });
});

describe("parseBackOrigin", () => {
  const good: BackOrigin = {
    meditationId: "a",
    href: "/discover?q=calm",
    label: "Discover",
    token: "t1",
  };
  const raw = (o: object) => JSON.stringify(o);

  it("accepts a well-formed record for this meditation", () => {
    expect(parseBackOrigin(raw(good), "a")).toEqual({ ...good, pendingAt: undefined });
  });

  it("ignores a record made for another meditation", () => {
    expect(parseBackOrigin(raw(good), "b")).toBeNull();
  });

  it("rejects anything but a same-origin path", () => {
    for (const href of ["https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
      expect(parseBackOrigin(raw({ ...good, href }), "a")).toBeNull();
    }
  });

  it("rejects malformed records", () => {
    expect(parseBackOrigin(null, "a")).toBeNull();
    expect(parseBackOrigin("{not json", "a")).toBeNull();
    expect(parseBackOrigin("null", "a")).toBeNull();
    expect(parseBackOrigin(raw({ ...good, label: "" }), "a")).toBeNull();
    expect(parseBackOrigin(raw({ ...good, label: "x".repeat(81) }), "a")).toBeNull();
    expect(parseBackOrigin(raw({ ...good, token: 5 }), "a")).toBeNull();
  });
});

describe("backTarget", () => {
  it("falls back to the owner's Library or Discover without a record", () => {
    expect(backTarget(null, true)).toEqual({ href: "/dashboard", label: "Library" });
    expect(backTarget(null, false)).toEqual({ href: "/discover", label: "Discover" });
  });

  it("prefers the record, even for the owner", () => {
    const origin = parseBackOrigin(
      JSON.stringify({ meditationId: "a", href: "/discover?category=sleep", label: "Discover", token: "t" }),
      "a",
    );
    expect(backTarget(origin, true)).toEqual({ href: "/discover?category=sleep", label: "Discover" });
  });
});

describe("isPending", () => {
  const origin: BackOrigin = { meditationId: "a", href: "/discover", label: "Discover", token: "t", pendingAt: 1000 };

  it("holds only briefly after the click", () => {
    expect(isPending(origin, 1000 + PENDING_MS - 1)).toBe(true);
    expect(isPending(origin, 1000 + PENDING_MS)).toBe(false);
    expect(isPending({ ...origin, pendingAt: undefined }, 1000)).toBe(false);
  });
});

describe("the flows", () => {
  it("returns an owner to filtered Discover, not the Library", () => {
    const back = roundTrip(memoryStorage(), ["/meditation/a", "/discover?q=sleep&type=guided", "Discover"]);
    expect(back("a", true)).toEqual({ href: "/discover?q=sleep&type=guided", label: "Discover" });
  });

  it("returns to the Library tab it was opened from", () => {
    const back = roundTrip(memoryStorage(), ["/meditation/a", "/dashboard?tab=favorites", "Library"]);
    expect(back("a", true)).toEqual({ href: "/dashboard?tab=favorites", label: "Library" });
  });

  it("returns to a collection by name", () => {
    const back = roundTrip(memoryStorage(), ["/meditation/a", "/collections/c1", "Evening wind-down"]);
    expect(back("a", true)).toEqual({ href: "/collections/c1", label: "Evening wind-down" });
  });

  it("Discover → A, then Library → B says Library on B and falls back on A", () => {
    const back = roundTrip(
      memoryStorage(),
      ["/meditation/a", "/discover", "Discover"],
      ["/meditation/b", "/dashboard", "Library"],
    );
    expect(back("b", false)).toEqual({ href: "/dashboard", label: "Library" });
    expect(back("a", false)).toEqual({ href: "/discover", label: "Discover" });
    expect(back("a", true)).toEqual({ href: "/dashboard", label: "Library" });
  });

  it("a meditation opened from an unlabelled page forgets the earlier record", () => {
    const back = roundTrip(
      memoryStorage(),
      ["/meditation/a", "/discover?q=calm", "Discover"],
      ["/meditation/a", "/", null],
    );
    expect(back("a", true)).toEqual({ href: "/dashboard", label: "Library" });
  });

  it("falls back with no record: a shared link or a fresh tab", () => {
    const back = roundTrip(memoryStorage());
    expect(back("a", false)).toEqual({ href: "/discover", label: "Discover" });
  });

  it("degrades to the fallback when storage throws", () => {
    writeOrigin(throwing, { meditationId: "a", href: "/discover", label: "Discover", token: "t" });
    expect(readRaw(throwing)).toBeNull();
    expect(readRaw(undefined)).toBeNull();
    expect(backTarget(parseBackOrigin(readRaw(throwing), "a"), true).label).toBe("Library");
  });

  it("stores under one key per tab", () => {
    const storage = memoryStorage();
    roundTrip(storage, ["/meditation/a", "/discover", "Discover"]);
    expect([...storage.data.keys()]).toEqual([BACK_ORIGIN_KEY]);
  });
});
