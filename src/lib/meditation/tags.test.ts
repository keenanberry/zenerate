import { describe, it, expect } from "vitest";
import {
  DISCOVER_CATEGORIES,
  TAG_GROUPS,
  TAG_LABELS,
  TAGS,
  isTag,
} from "./tags";

describe("TAGS", () => {
  it("holds 20 to 40 tags", () => {
    expect(TAGS.length).toBeGreaterThanOrEqual(20);
    expect(TAGS.length).toBeLessThanOrEqual(40);
  });

  it("has no duplicates across groups", () => {
    expect(new Set(TAGS).size).toBe(TAGS.length);
  });

  it("uses lowercase kebab-case slugs", () => {
    for (const tag of TAGS) expect(tag).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("is exactly the three groups, in order", () => {
    expect([...TAGS]).toEqual([
      ...TAG_GROUPS.themes,
      ...TAG_GROUPS.practices,
      ...TAG_GROUPS.moments,
    ]);
  });

  it("labels every tag", () => {
    expect(Object.keys(TAG_LABELS).sort()).toEqual([...TAGS].sort());
  });

  it("isTag accepts vocabulary and rejects anything else", () => {
    expect(isTag("sleep")).toBe(true);
    expect(isTag("python")).toBe(false);
  });
});

describe("DISCOVER_CATEGORIES", () => {
  it("has 8 categories with unique slugs", () => {
    expect(DISCOVER_CATEGORIES).toHaveLength(8);
    const slugs = DISCOVER_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(8);
  });

  it("only names tags from the vocabulary, at least two each", () => {
    for (const category of DISCOVER_CATEGORIES) {
      expect(category.tags.length).toBeGreaterThanOrEqual(2);
      for (const tag of category.tags) expect(isTag(tag)).toBe(true);
    }
  });

  it("reaches every tag from some category", () => {
    const covered = new Set(DISCOVER_CATEGORIES.flatMap((c) => c.tags));
    expect(TAGS.filter((t) => !covered.has(t))).toEqual([]);
  });
});
