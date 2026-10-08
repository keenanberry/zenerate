import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockGetMeditation, mockFetch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetMeditation: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/meditation/actions", () => ({
  getMeditation: mockGetMeditation,
}));

import { GET } from "./route";

const SIGNED_URL = "https://example.supabase.co/storage/v1/object/sign/x?token=y";

function req() {
  return new Request("http://localhost/api/audio/abc/download");
}
function ctx(id = "abc") {
  return { params: Promise.resolve({ id }) };
}
function audioResponse(body = "fake-mp3-bytes", init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-length": String(body.length) },
    ...init,
  });
}

describe("GET /api/audio/[id]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMeditation.mockResolvedValue({
      id: "abc",
      title: "Morning Calm — Gratitude",
      audio_url: SIGNED_URL,
    });
    mockFetch.mockResolvedValue(audioResponse());
  });

  describe("downloads are for signed-in users", () => {
    it("401s with no session, even for a public meditation", async () => {
      // Signed-out visitors can read public meditations (task 18b) and so
      // could reach this route; keeping a copy is reserved for accounts.
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await GET(req(), ctx());

      expect(res.status).toBe(401);
      expect(mockGetMeditation).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("authorization is delegated, not reimplemented", () => {
    it("fetches the row through getMeditation, the RLS-bound fetcher", async () => {
      await GET(req(), ctx("abc"));
      expect(mockGetMeditation).toHaveBeenCalledWith("abc");
    });

    it("404s when getMeditation throws", async () => {
      // Covers both "no such row" and "RLS hid it from this caller".
      mockGetMeditation.mockRejectedValue(new Error("no rows returned"));
      const res = await GET(req(), ctx());

      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not reveal whether a hidden meditation exists", async () => {
      // A different status or message for "exists but not yours" would let an
      // anonymous caller enumerate meditation ids.
      mockGetMeditation.mockRejectedValue(new Error("row not visible"));
      const hidden = await GET(req(), ctx());
      mockGetMeditation.mockRejectedValue(new Error("no rows returned"));
      const missing = await GET(req(), ctx());

      expect(hidden.status).toBe(missing.status);
      await expect(hidden.json()).resolves.toEqual(await missing.json());
    });
  });

  describe("when there is no audio", () => {
    it("404s on a null audio_url", async () => {
      mockGetMeditation.mockResolvedValue({ id: "abc", title: "x", audio_url: null });
      const res = await GET(req(), ctx());

      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("a successful download", () => {
    it("streams the object from the signed URL", async () => {
      const res = await GET(req(), ctx());

      expect(mockFetch).toHaveBeenCalledWith(SIGNED_URL);
      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toBe("fake-mp3-bytes");
    });

    it("sets an attachment disposition with the slugified title", async () => {
      const res = await GET(req(), ctx());

      expect(res.headers.get("content-disposition")).toBe(
        'attachment; filename="morning-calm-gratitude.mp3"',
      );
      expect(res.headers.get("content-type")).toBe("audio/mpeg");
    });

    it("never caches — the response is one user's private audio", async () => {
      const res = await GET(req(), ctx());
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    });

    it("passes through content-length when upstream provides it", async () => {
      const res = await GET(req(), ctx());
      expect(res.headers.get("content-length")).toBe("14");
    });

    it("falls back to a safe filename for a degenerate title", async () => {
      mockGetMeditation.mockResolvedValue({
        id: "abc",
        title: "!!!",
        audio_url: SIGNED_URL,
      });
      const res = await GET(req(), ctx());

      // Not `filename=".mp3"`, which is a hidden file on macOS and Linux.
      expect(res.headers.get("content-disposition")).toBe(
        'attachment; filename="meditation.mp3"',
      );
    });

    it("cannot have its header broken by a hostile title", async () => {
      mockGetMeditation.mockResolvedValue({
        id: "abc",
        title: 'evil"; filename="owned.exe',
        audio_url: SIGNED_URL,
      });
      const res = await GET(req(), ctx());
      const disposition = res.headers.get("content-disposition") ?? "";

      expect(disposition).toBe(
        'attachment; filename="evil-filename-owned-exe.mp3"',
      );
      // One filename parameter, and it still ends in .mp3.
      expect(disposition.match(/filename=/g)).toHaveLength(1);
    });
  });

  describe("when storage fails", () => {
    it("502s rather than returning a broken file", async () => {
      mockFetch.mockResolvedValue(new Response("nope", { status: 403 }));
      const res = await GET(req(), ctx());

      expect(res.status).toBe(502);
    });
  });
});
