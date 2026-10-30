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
  /** Rows the service-role lookup of public meditations returns. */
  publicRows?: unknown[];
}) {
  const lookup = {
    filters: [] as [string, string, unknown][],
    select: vi.fn(() => lookup),
    in: vi.fn((column: string, values: unknown) => (lookup.filters.push(["in", column, values]), lookup)),
    eq: vi.fn((column: string, value: unknown) => {
      lookup.filters.push(["eq", column, value]);
      return Promise.resolve({ data: impl.publicRows ?? [], error: null });
    }),
  };
  return {
    lookup,
    from: vi.fn(() => lookup),
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

    const result = await hydrateAudioUrl({ id: "med-1", user_id: "u", audio_path: null });
    expect(result).toEqual({ id: "med-1", user_id: "u", audio_path: null, audio_url: null });
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("signs a path with the configured TTL using the service-role client", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed/abc" }, error: null });
    const supabase = makeStorage({ createSignedUrl });
    mockCreateServiceClient.mockReturnValue(supabase);

    const row = { id: "med-1", user_id: "u", audio_path: "u/med-1/r.mp3", title: "t" };
    const result = await hydrateAudioUrl(row);
    expect(result).toEqual({ ...row, audio_url: "https://signed/abc" });
    expect(createSignedUrl).toHaveBeenCalledWith("u/med-1/r.mp3", AUDIO_URL_TTL_SECONDS);
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
  });

  it("returns a null audio_url rather than throwing when signing fails", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "object not found" } });
    const supabase = makeStorage({ createSignedUrl });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrl({ id: "med-1", user_id: "u", audio_path: "u/med-1/missing.mp3" });
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

    // Legacy root-level files are <meditation_id>.mp3.
    const rows = [
      { id: "a", user_id: "u", audio_path: "a.mp3" },
      { id: "x", user_id: "u", audio_path: null },
      { id: "b", user_id: "u", audio_path: "b.mp3" },
    ];
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

    const rows = [
      { id: "a", user_id: "u", audio_path: "a.mp3" },
      { id: "b", user_id: "u", audio_path: "b.mp3" },
    ];
    const result = await hydrateAudioUrls(rows);
    expect(result.map((r) => r.audio_url)).toEqual([null, null]);
  });
});

describe("a path outside the row's own folder", () => {
  // Before task 58 the owner could write audio_path, so a row could name
  // someone else's file. The signer is the service role; it would sign it.
  it.each([
    ["another user's folder", "victim/med-1/r.mp3"],
    ["another meditation's folder", "u/other-med/r.mp3"],
    ["another meditation's legacy file", "other-med.mp3"],
    ["a path that climbs out", "u/med-1/../../victim/m/r.mp3"],
    ["a nested path", "u/med-1/sub/r.mp3"],
  ])("hydrates %s to a null audio_url without signing it", async (_, audio_path) => {
    const createSignedUrl = vi.fn();
    mockCreateServiceClient.mockReturnValue(makeStorage({ createSignedUrl }));

    const result = await hydrateAudioUrl({ id: "med-1", user_id: "u", audio_path });
    expect(result.audio_url).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("leaves a foreign path out of a batch and signs the rest", async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{ path: "u/a/r.mp3", signedUrl: "https://signed/a", error: null }],
      error: null,
    });
    mockCreateServiceClient.mockReturnValue(makeStorage({ createSignedUrls }));

    const result = await hydrateAudioUrls([
      { id: "a", user_id: "u", audio_path: "u/a/r.mp3" },
      { id: "b", user_id: "u", audio_path: "victim/their-med/r.mp3" },
    ]);
    expect(result.map((r) => r.audio_url)).toEqual(["https://signed/a", null]);
    expect(createSignedUrls).toHaveBeenCalledWith(["u/a/r.mp3"], AUDIO_URL_TTL_SECONDS);
  });

  it("checks an archived version against its meditation's folder", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed/v" }, error: null });
    mockCreateServiceClient.mockReturnValue(makeStorage({ createSignedUrl }));

    const own = await hydrateAudioUrl({ id: "ver-1", meditation_id: "med-1", audio_path: "u/med-1/old.mp3" });
    const foreign = await hydrateAudioUrl({ id: "ver-2", meditation_id: "med-1", audio_path: "victim/their-med/r.mp3" });
    expect(own.audio_url).toBe("https://signed/v");
    expect(foreign.audio_url).toBeNull();
  });
});

describe("a row read as anon, without audio_path", () => {
  it("looks the path up for public meditations only, and never adds it to the row", async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{ path: "u/a/r.mp3", signedUrl: "https://signed/a", error: null }],
      error: null,
    });
    const supabase = makeStorage({
      createSignedUrls,
      publicRows: [
        { id: "a", user_id: "u", audio_path: "u/a/r.mp3" },
        { id: "b", user_id: "u", audio_path: "victim/their-med/r.mp3" },
      ],
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const result = await hydrateAudioUrls([
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ]);

    expect(result).toEqual([
      { id: "a", title: "A", audio_url: "https://signed/a" },
      { id: "b", title: "B", audio_url: null },
      { id: "c", title: "C", audio_url: null },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("meditations");
    expect(supabase.lookup.filters).toEqual([
      ["in", "id", ["a", "b", "c"]],
      ["eq", "is_public", true],
    ]);
  });

  it("makes no lookup when every row carries its path", async () => {
    const supabase = makeStorage({ createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }) });
    mockCreateServiceClient.mockReturnValue(supabase);
    await hydrateAudioUrls([{ id: "a", user_id: "u", audio_path: null }]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
