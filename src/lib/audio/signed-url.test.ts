import { describe, it, expect, vi } from "vitest";
import { signAudioUrl, signAudioUrls, AUDIO_URL_TTL_SECONDS } from "./signed-url";

function makeStorage(impl: {
  createSignedUrl?: unknown;
  createSignedUrls?: unknown;
}) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: impl.createSignedUrl,
        createSignedUrls: impl.createSignedUrls,
      }),
    },
  };
}

describe("AUDIO_URL_TTL_SECONDS", () => {
  it("is four hours", () => {
    expect(AUDIO_URL_TTL_SECONDS).toBe(4 * 60 * 60);
  });
});

describe("signAudioUrl", () => {
  it("returns null for a null path without calling storage", async () => {
    const supabase = makeStorage({ createSignedUrl: vi.fn() });
    const result = await signAudioUrl(null, supabase as never);
    expect(result).toBeNull();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("signs a path with the configured TTL", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed/abc" }, error: null });
    const supabase = makeStorage({ createSignedUrl });
    const result = await signAudioUrl("abc.mp3", supabase as never);
    expect(result).toBe("https://signed/abc");
    expect(createSignedUrl).toHaveBeenCalledWith("abc.mp3", AUDIO_URL_TTL_SECONDS);
  });

  it("returns null rather than throwing when signing fails", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "object not found" } });
    const supabase = makeStorage({ createSignedUrl });
    const result = await signAudioUrl("missing.mp3", supabase as never);
    expect(result).toBeNull();
  });
});

describe("signAudioUrls", () => {
  it("returns an empty array without calling storage when given no paths", async () => {
    const supabase = makeStorage({ createSignedUrls: vi.fn() });
    const result = await signAudioUrls([], supabase as never);
    expect(result).toEqual([]);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("preserves order and null slots", async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: "a.mp3", signedUrl: "https://signed/a", error: null },
        { path: "b.mp3", signedUrl: "https://signed/b", error: null },
      ],
      error: null,
    });
    const supabase = makeStorage({ createSignedUrls });
    const result = await signAudioUrls(["a.mp3", null, "b.mp3"], supabase as never);
    expect(result).toEqual(["https://signed/a", null, "https://signed/b"]);
    expect(createSignedUrls).toHaveBeenCalledWith(["a.mp3", "b.mp3"], AUDIO_URL_TTL_SECONDS);
  });

  it("returns all nulls when the batch call errors", async () => {
    const createSignedUrls = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "bucket missing" } });
    const supabase = makeStorage({ createSignedUrls });
    const result = await signAudioUrls(["a.mp3", "b.mp3"], supabase as never);
    expect(result).toEqual([null, null]);
  });
});
