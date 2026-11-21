import { describe, expect, it } from "vitest";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_OUTPUT_BYTES,
  AVATAR_SIZE,
  avatarPath,
  avatarPublicBase,
  centreSquare,
  ownAvatarPath,
} from "./avatar";

describe("centreSquare", () => {
  it("landscape: the middle of the width", () => {
    expect(centreSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });

  it("portrait: the middle of the height", () => {
    expect(centreSquare(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 });
  });

  it("square: the whole image", () => {
    expect(centreSquare(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
  });

  it("odd differences round down to whole pixels", () => {
    expect(centreSquare(101, 100)).toEqual({ sx: 0, sy: 0, size: 100 });
    expect(centreSquare(100, 103)).toEqual({ sx: 0, sy: 1, size: 100 });
  });
});

describe("avatarPath", () => {
  it("is the user's folder and a random WebP name", () => {
    expect(avatarPath("u1", "abc")).toBe("u1/abc.webp");
  });

  it("a JPEG (Safari's fallback) is stored as .jpg", () => {
    expect(avatarPath("u1", "abc", "image/jpeg")).toBe("u1/abc.jpg");
  });
});

describe("ownAvatarPath", () => {
  const base = "https://proj.supabase.co/storage/v1/object/public/avatars/";
  const user = "11111111-1111-1111-1111-111111111111";

  it("the object path for a public URL in the user's own folder", () => {
    expect(ownAvatarPath(`${base}${user}/a.webp`, user, base)).toBe(`${user}/a.webp`);
  });

  it("accepts a base without the trailing slash", () => {
    expect(ownAvatarPath(`${base}${user}/a.webp`, user, base.slice(0, -1))).toBe(`${user}/a.webp`);
  });

  it("null for no URL", () => {
    expect(ownAvatarPath(null, user, base)).toBeNull();
    expect(ownAvatarPath("", user, base)).toBeNull();
  });

  it("null for an external URL", () => {
    expect(ownAvatarPath("https://example.com/a.png", user, base)).toBeNull();
  });

  it("null for another user's folder", () => {
    expect(ownAvatarPath(`${base}someone-else/a.webp`, user, base)).toBeNull();
    // A user id that merely starts with this one is someone else's.
    expect(ownAvatarPath(`${base}${user}x/a.webp`, user, base)).toBeNull();
  });

  it("null for another bucket, a nested path, traversal, or a query", () => {
    const other = base.replace("/avatars/", "/meditation-audio/");
    expect(ownAvatarPath(`${other}${user}/a.webp`, user, base)).toBeNull();
    expect(ownAvatarPath(`${base}${user}/x/a.webp`, user, base)).toBeNull();
    expect(ownAvatarPath(`${base}${user}/../other/a.webp`, user, base)).toBeNull();
    expect(ownAvatarPath(`${base}${user}/..`, user, base)).toBeNull();
    expect(ownAvatarPath(`${base}${user}/a.webp?x=1`, user, base)).toBeNull();
    expect(ownAvatarPath(`${base}${user}/`, user, base)).toBeNull();
  });

  it("null when the user id is empty", () => {
    expect(ownAvatarPath(`${base}/a.webp`, "", base)).toBeNull();
  });
});

describe("avatarPublicBase", () => {
  it("is the bucket's public object prefix, with or without a trailing slash on the project URL", () => {
    expect(avatarPublicBase("https://proj.supabase.co")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/avatars/",
    );
    expect(avatarPublicBase("https://proj.supabase.co/")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/avatars/",
    );
  });
});

describe("limits", () => {
  it("match the design: a 512px square, 15 MB in, 1 MB out", () => {
    expect(AVATAR_BUCKET).toBe("avatars");
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_MAX_INPUT_BYTES).toBe(15 * 1024 * 1024);
    expect(AVATAR_MAX_OUTPUT_BYTES).toBe(1024 * 1024);
  });
});
