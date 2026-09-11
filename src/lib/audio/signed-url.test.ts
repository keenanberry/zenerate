import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateServiceClient } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createClient: mockCreateServiceClient,
}));

import { hydrateAudioUrl, hydrateAudioUrls, AUDIO_URL_TTL_SECONDS } from "./signed-url";

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

beforeEach(() => {
  mockCreateServiceClient.mockReset();
});

describe("AUDIO_URL_TTL_SECONDS", () => {
  it("is four hours", () => {
    expect(AUDIO_URL_TTL_SECONDS).toBe(4 * 60 * 60);
  });
});

describe("hydrateAudioUrl", () => {
  it("returns a null audio_url for a null path without calling storage", async () => {
    const supabase = makeStorage({ createSignedUrl: vi.fn() });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrl({ audio_path: null });
    expect(result).toEqual({ audio_path: null, audio_url: null });
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("signs a path with the configured TTL using the service-role client", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed/abc" }, error: null });
    const supabase = makeStorage({ createSignedUrl });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrl({ audio_path: "abc.mp3", title: "t" });
    expect(result).toEqual({ audio_path: "abc.mp3", title: "t", audio_url: "https://signed/abc" });
    expect(createSignedUrl).toHaveBeenCalledWith("abc.mp3", AUDIO_URL_TTL_SECONDS);
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
  });

  it("returns a null audio_url rather than throwing when signing fails", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "object not found" } });
    const supabase = makeStorage({ createSignedUrl });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrl({ audio_path: "missing.mp3" });
    expect(result.audio_url).toBeNull();
  });
});

describe("hydrateAudioUrls", () => {
  it("returns an empty array without calling storage when given no rows", async () => {
    const supabase = makeStorage({ createSignedUrls: vi.fn() });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrls([]);
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
    mockCreateServiceClient.mockReturnValue(supabase);

    const rows = [{ audio_path: "a.mp3" }, { audio_path: null }, { audio_path: "b.mp3" }];
    const result = await hydrateAudioUrls(rows);
    expect(result.map((r) => r.audio_url)).toEqual([
      "https://signed/a",
      null,
      "https://signed/b",
    ]);
    expect(createSignedUrls).toHaveBeenCalledWith(["a.mp3", "b.mp3"], AUDIO_URL_TTL_SECONDS);
  });

  it("returns all-null audio_urls when the batch call errors", async () => {
    const createSignedUrls = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "bucket missing" } });
    const supabase = makeStorage({ createSignedUrls });
    mockCreateServiceClient.mockReturnValue(supabase);

    const rows = [{ audio_path: "a.mp3" }, { audio_path: "b.mp3" }];
    const result = await hydrateAudioUrls(rows);
    expect(result.map((r) => r.audio_url)).toEqual([null, null]);
  });
});
