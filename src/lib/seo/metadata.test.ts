import { describe, expect, it } from "vitest";
import {
  FALLBACK_SITE_URL,
  PITCH,
  defaultMetadata,
  describeMeditation,
  meditationMetadata,
  pageMetadata,
  resolveSiteUrl,
  sitemapEntries,
  truncate,
} from "./metadata";

describe("resolveSiteUrl", () => {
  it("falls back to the production domain when unset or blank", () => {
    expect(resolveSiteUrl(undefined).href).toBe(`${FALLBACK_SITE_URL}/`);
    expect(resolveSiteUrl("  ").href).toBe(`${FALLBACK_SITE_URL}/`);
  });

  it("keeps only the origin", () => {
    expect(resolveSiteUrl("https://example.com/some/path/").href).toBe("https://example.com/");
    expect(resolveSiteUrl("http://localhost:3126").href).toBe("http://localhost:3126/");
  });

  it("accepts a bare host, as it tends to be pasted into Vercel", () => {
    expect(resolveSiteUrl("www.zeneratestudio.com").href).toBe("https://www.zeneratestudio.com/");
  });

  it("falls back rather than throwing on a malformed value", () => {
    expect(resolveSiteUrl("https://exa mple.com").href).toBe(`${FALLBACK_SITE_URL}/`);
  });
});

describe("truncate", () => {
  it("leaves short text alone, flattening whitespace", () => {
    expect(truncate("one\n  two")).toBe("one two");
  });

  it("cuts at a word boundary and stays within the limit", () => {
    const out = truncate("alpha beta gamma delta", 14);
    expect(out).toBe("alpha beta…");
    expect(out.length).toBeLessThanOrEqual(14);
  });
});

describe("describeMeditation", () => {
  it("describes the meditation from its settings and states the AI", () => {
    expect(describeMeditation({ type: "guided", duration: 10, focus: "gratitude" })).toBe(
      "A 10-minute guided meditation on gratitude, written and narrated with AI on Zenerate. Free to listen, no account needed.",
    );
  });

  it("reads hyphenated types as words", () => {
    expect(describeMeditation({ type: "body-scan", duration: 15 })).toMatch(
      /^A 15-minute body scan meditation, /,
    );
  });

  it("chooses the article by sound", () => {
    expect(describeMeditation({ duration: 8 })).toMatch(/^An 8-minute meditation/);
    expect(describeMeditation({ duration: 11 })).toMatch(/^An 11-minute/);
    expect(describeMeditation({ duration: 18 })).toMatch(/^An 18-minute/);
    expect(describeMeditation({ duration: 1 })).toMatch(/^A 1-minute/);
    expect(describeMeditation({ duration: 5 })).toMatch(/^A 5-minute/);
  });

  it("survives empty or missing settings", () => {
    expect(describeMeditation(null)).toMatch(/^A meditation, written and narrated with AI/);
    expect(describeMeditation({})).toMatch(/^A meditation, /);
  });

  it("keeps a long focus within the description limit", () => {
    const out = describeMeditation({ type: "sleep", duration: 20, focus: "letting go ".repeat(30) });
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("defaultMetadata", () => {
  it("uses the locked pitch and a large-image card", () => {
    expect(defaultMetadata.description).toBe(PITCH);
    expect(defaultMetadata.openGraph.description).toBe(PITCH);
    expect(defaultMetadata.twitter.card).toBe("summary_large_image");
    expect(defaultMetadata.openGraph.images[0].url).toBe("/og-image.png");
  });
});

describe("pageMetadata", () => {
  it("carries the image and card type into a page's own share card", () => {
    const m = pageMetadata({ title: "T | Zenerate", socialTitle: "T", description: "D", path: "/x" });
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph).toMatchObject({ title: "T", description: "D", url: "/x", siteName: "Zenerate" });
    expect(m.openGraph?.images).toEqual(defaultMetadata.openGraph.images);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "T", description: "D" });
  });
});

describe("meditationMetadata", () => {
  const base = {
    id: "abc",
    title: "Evening Release",
    settings: { type: "sleep", duration: 20, focus: "letting go" },
  };

  it("gives a missing meditation a generic title and nothing else", () => {
    const m = meditationMetadata(null);
    expect(m.title).toBe("Meditation | Zenerate");
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.robots).toEqual({ index: false });
  });

  it("gives a private meditation no description, share card or index", () => {
    const m = meditationMetadata({ ...base, is_public: false });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.twitter).toBeUndefined();
    expect(m.robots).toEqual({ index: false });
  });

  it("gives a public meditation its own title, description and share card", () => {
    const m = meditationMetadata({ ...base, is_public: true });
    expect(m.title).toBe("Evening Release | Zenerate");
    expect(m.description).toMatch(/^A 20-minute sleep meditation on letting go/);
    expect(m.openGraph).toMatchObject({ title: "Evening Release", url: "/meditation/abc" });
    expect(m.robots).toBeUndefined();
  });
});

describe("sitemapEntries", () => {
  it("lists the public pages and each public meditation as absolute URLs", () => {
    const entries = sitemapEntries(new URL("https://example.com"), [
      { id: "m1", updated_at: "2026-10-01T00:00:00Z" },
    ]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://example.com/",
      "https://example.com/discover",
      "https://example.com/terms",
      "https://example.com/privacy",
      "https://example.com/meditation/m1",
    ]);
    expect(entries.at(-1)?.lastModified).toBe("2026-10-01T00:00:00Z");
  });
});
