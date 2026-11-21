import { afterEach, describe, expect, it, vi } from "vitest";
import { coverMiddle, coverThumb, coverUrl, withCoverUrl } from "./url";

const BASE = "https://abc.supabase.co";

describe("coverUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is null with no path", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
    expect(coverUrl(null)).toBeNull();
    expect(coverUrl(undefined)).toBeNull();
    expect(coverUrl("")).toBeNull();
  });

  it("is the object's public URL in the covers bucket", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
    expect(coverUrl("m1/a.webp")).toBe(`${BASE}/storage/v1/object/public/meditation-covers/m1/a.webp`);
  });

  it("does not double the slash after a project URL that ends in one", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${BASE}/`);
    expect(coverUrl("m1/a.webp")).toBe(`${BASE}/storage/v1/object/public/meditation-covers/m1/a.webp`);
  });

  it("encodes each segment, keeping the folder's slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
    expect(coverUrl("m 1/a b#c.webp")).toBe(
      `${BASE}/storage/v1/object/public/meditation-covers/m%201/a%20b%23c.webp`,
    );
  });

  it("is null without a project URL rather than a relative path", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(coverUrl("m1/a.webp")).toBeNull();
  });
});

describe("withCoverUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds cover_url from cover_path, null when there is none", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
    expect(withCoverUrl({ id: "m1", cover_path: "m1/a.webp" })).toEqual({
      id: "m1",
      cover_path: "m1/a.webp",
      cover_url: `${BASE}/storage/v1/object/public/meditation-covers/m1/a.webp`,
    });
    const uncovered: { id: string; cover_path?: string | null } = { id: "m2" };
    expect(withCoverUrl(uncovered)).toEqual({ id: "m2", cover_url: null });
  });
});

describe("coverThumb", () => {
  it("names the thumbnail beside the full image", () => {
    expect(coverThumb("m1/a.webp")).toBe("m1/a.thumb.webp");
    expect(coverThumb(`${BASE}/storage/v1/object/public/meditation-covers/m1/a.webp`)).toBe(
      `${BASE}/storage/v1/object/public/meditation-covers/m1/a.thumb.webp`,
    );
  });

  it("touches only the file name, never a dot earlier in the path or host", () => {
    expect(coverThumb("https://abc.supabase.co/x/m1/abc")).toBe("https://abc.supabase.co/x/m1/abc.thumb");
    expect(coverThumb("m1/a.b.jpg")).toBe("m1/a.b.thumb.jpg");
  });
});

describe("coverMiddle", () => {
  it("names the 512px middle size beside the full image", () => {
    expect(coverMiddle("m1/a.webp")).toBe("m1/a.md.webp");
    expect(coverMiddle(`${BASE}/storage/v1/object/public/meditation-covers/m1/a.webp`)).toBe(
      `${BASE}/storage/v1/object/public/meditation-covers/m1/a.md.webp`,
    );
  });

  it("touches only the file name, like the thumbnail", () => {
    expect(coverMiddle("https://abc.supabase.co/x/m1/abc")).toBe("https://abc.supabase.co/x/m1/abc.md");
    expect(coverMiddle("m1/a.b.jpg")).toBe("m1/a.b.md.jpg");
  });
});
