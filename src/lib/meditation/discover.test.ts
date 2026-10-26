import { describe, expect, it } from "vitest";
import {
  DURATION_BUCKETS,
  discoverHref,
  fillRow,
  followUrlQuery,
  hasActiveFilters,
  parseDiscoverFilters,
  rankByTagAffinity,
  tagWeights,
  toSearchArgs,
} from "./discover";

describe("parseDiscoverFilters", () => {
  it("keeps values in the vocabulary and drops the rest", () => {
    expect(
      parseDiscoverFilters({
        q: "  sleep  ",
        category: "sleep",
        tag: "bedtime",
        type: "body-scan",
        duration: "10",
      }),
    ).toEqual({
      q: "sleep",
      category: "sleep",
      tag: "bedtime",
      type: "body-scan",
      duration: "10",
    });
    expect(
      parseDiscoverFilters({
        q: "   ",
        category: "nope",
        tag: "not-a-tag",
        type: "hypnosis",
        duration: "7",
      }),
    ).toEqual({});
  });

  it("takes the first of a repeated param", () => {
    expect(parseDiscoverFilters({ tag: ["sleep", "focus"] })).toEqual({ tag: "sleep" });
  });

  it("is inactive when empty", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ duration: "5" })).toBe(true);
  });
});

describe("DURATION_BUCKETS", () => {
  it("puts every length from 1 to 90 minutes in exactly one bucket", () => {
    for (let minutes = 1; minutes <= 90; minutes++) {
      const hits = DURATION_BUCKETS.filter(
        (b) => (b.min === null || minutes >= b.min) && (b.max === null || minutes <= b.max),
      );
      expect(hits, `${minutes} min`).toHaveLength(1);
    }
  });
});

describe("toSearchArgs", () => {
  it("maps a category to its tags and a bucket to its bounds", () => {
    expect(toSearchArgs({ category: "morning", duration: "20" })).toEqual({
      q: null,
      any_tags: ["morning", "energy"],
      tag: null,
      meditation_type: null,
      min_minutes: 18,
      max_minutes: null,
      row_limit: 50,
    });
  });
});

describe("discoverHref", () => {
  it("applies a patch and drops cleared keys in a fixed order", () => {
    expect(discoverHref({ tag: "sleep", q: "calm" }, { duration: "5" })).toBe(
      "/discover?q=calm&tag=sleep&duration=5",
    );
    expect(discoverHref({ tag: "sleep" }, { tag: undefined })).toBe("/discover");
  });
});

describe("fillRow", () => {
  const m = (id: string) => ({ id });

  it("leads with primary, pads from fallback, never repeats", () => {
    expect(fillRow([m("a"), m("b")], [m("b"), m("c"), m("d")], 3).map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("is all fallback when primary is empty", () => {
    expect(fillRow([], [m("x"), m("y")]).map((x) => x.id)).toEqual(["x", "y"]);
  });
});

describe("rankByTagAffinity", () => {
  it("ranks by shared tag weight and drops no-overlap candidates", () => {
    const weights = tagWeights([
      { tags: ["sleep", "bedtime"] },
      { tags: ["sleep"] },
      { tags: null },
    ]);
    expect(weights.get("sleep")).toBe(2);

    const ranked = rankByTagAffinity(
      [
        { id: "focus", tags: ["focus"] },
        { id: "bed", tags: ["bedtime"] },
        { id: "both", tags: ["sleep", "bedtime"] },
        { id: "sleep", tags: ["sleep"] },
      ],
      weights,
    );
    expect(ranked.map((r) => r.id)).toEqual(["both", "sleep", "bed"]);
  });
});

describe("followUrlQuery", () => {
  it("ignores an older query that lands while newer typing is on its way", () => {
    // "sle" was sent; "sleep" typed during the render; "sle" lands.
    const field = { text: "sleep", awaiting: "sleep" };
    expect(followUrlQuery(field, "sle")).toBe(field);
  });

  it("ends the wait when the URL reaches the typed query, keeping the text as typed", () => {
    expect(followUrlQuery({ text: "sleep ", awaiting: "sleep" }, "sleep")).toEqual({
      text: "sleep ",
      awaiting: null,
    });
  });

  it("ends the wait for a cleared query", () => {
    expect(followUrlQuery({ text: "", awaiting: "" }, undefined)).toEqual({ text: "", awaiting: null });
  });

  it("follows a change from outside the field", () => {
    expect(followUrlQuery({ text: "sleep", awaiting: null }, "calm")).toEqual({
      text: "calm",
      awaiting: null,
    });
    expect(followUrlQuery({ text: "sleep", awaiting: null }, undefined)).toEqual({
      text: "",
      awaiting: null,
    });
  });

  it("leaves the field alone when it already matches the URL", () => {
    const field = { text: " calm ", awaiting: null };
    expect(followUrlQuery(field, "calm")).toBe(field);
  });
});
