import { describe, expect, it, vi } from "vitest";
import { AVATAR_MAX_INPUT_BYTES, AVATAR_MAX_OUTPUT_BYTES, AVATAR_MAX_PIXELS } from "./avatar";
import { AvatarError, checkAvatarDimensions, checkAvatarFile, encodeAvatar } from "./resize-avatar";

const blob = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });

describe("checkAvatarFile", () => {
  it("accepts an image within the limit", () => {
    expect(checkAvatarFile({ type: "image/jpeg", size: 3_000_000 })).toBeNull();
    expect(checkAvatarFile({ type: "image/heic", size: AVATAR_MAX_INPUT_BYTES })).toBeNull();
  });

  it("refuses something that is not an image", () => {
    expect(checkAvatarFile({ type: "application/pdf", size: 10 })).toMatch(/image/);
  });

  it("refuses a file over 15 MB before decoding it", () => {
    expect(checkAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_INPUT_BYTES + 1 })).toMatch(/15 MB/);
  });

  it("lets a file with no type through to the decoder, which decides", () => {
    // Some browsers report HEIC as "", and the accept filter already chose images.
    expect(checkAvatarFile({ type: "", size: 10 })).toBeNull();
  });
});

describe("checkAvatarDimensions", () => {
  it("accepts a 48 MP iPhone photo", () => {
    expect(checkAvatarDimensions(8064, 6048)).toBeNull();
  });

  it("refuses an image over the pixel cap with a clear message", () => {
    expect(checkAvatarDimensions(10_000, 10_000)).toMatch(/50 megapixels/);
    expect(AVATAR_MAX_PIXELS).toBe(50_000_000);
  });

  it("refuses an image with no pixels as unreadable", () => {
    expect(checkAvatarDimensions(0, 100)).toMatch(/Couldn't read/);
  });
});

describe("encodeAvatar", () => {
  it("WebP at the first quality when the browser can encode it", async () => {
    const encode = vi.fn(async (type: string) => blob(type, 50_000));
    const out = await encodeAvatar(encode);
    expect(out.type).toBe("image/webp");
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith("image/webp", 0.85);
  });

  it("falls back to JPEG when the browser hands back something else (Safari's PNG)", async () => {
    const encode = vi.fn(async (type: string) => blob(type === "image/webp" ? "image/png" : type, 50_000));
    const out = await encodeAvatar(encode);
    expect(out.type).toBe("image/jpeg");
    expect(encode.mock.calls).toEqual([
      ["image/webp", 0.85],
      ["image/jpeg", 0.85],
    ]);
  });

  it("retries once at a lower quality when the first encode is over 1 MB", async () => {
    const encode = vi.fn(async (type: string, quality: number) =>
      blob(type, quality >= 0.85 ? AVATAR_MAX_OUTPUT_BYTES + 1 : 200_000),
    );
    const out = await encodeAvatar(encode);
    expect(out.size).toBe(200_000);
    expect(encode).toHaveBeenCalledTimes(2);
    expect(encode.mock.calls[1][0]).toBe("image/webp");
    expect(encode.mock.calls[1][1]).toBeLessThan(0.85);
  });

  it("fails with a clear error when even the retry is over 1 MB", async () => {
    const encode = vi.fn(async (type: string) => blob(type, AVATAR_MAX_OUTPUT_BYTES + 1));
    await expect(encodeAvatar(encode)).rejects.toThrow(AvatarError);
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it("fails with a clear error when the browser cannot encode at all", async () => {
    await expect(encodeAvatar(async () => null)).rejects.toThrow(AvatarError);
  });
});
