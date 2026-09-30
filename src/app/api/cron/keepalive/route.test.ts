import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSelect, mockFrom, mockFetch } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { GET } from "./route";

const SECRET = "test-cron-secret-value";

function get(authorization?: string) {
  return new Request("http://localhost/api/cron/keepalive", {
    method: "GET",
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/keepalive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    delete process.env.KEEPALIVE_PING_URL;
    mockSelect.mockResolvedValue({ count: 7, error: null });
    mockFrom.mockReturnValue({ select: mockSelect });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CRON_SECRET;
    delete process.env.KEEPALIVE_PING_URL;
  });

  describe("authorization", () => {
    it("fails closed with 503 when CRON_SECRET is unset", async () => {
      // The important case: a forgotten env var must not leave this open.
      delete process.env.CRON_SECRET;
      const res = await GET(get(`Bearer ${SECRET}`));

      expect(res.status).toBe(503);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects a request with no Authorization header", async () => {
      const res = await GET(get());

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret", async () => {
      const res = await GET(get("Bearer not-the-secret-at-all"));

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects a correct secret sent without the Bearer scheme", async () => {
      const res = await GET(get(SECRET));

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects a secret that is a prefix of the real one", async () => {
      const res = await GET(get(`Bearer ${SECRET.slice(0, -1)}`));

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("accepts the correct bearer secret", async () => {
      const res = await GET(get(`Bearer ${SECRET}`));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ ok: true, meditations: 7 });
    });
  });

  describe("the database read", () => {
    it("queries meditations with head:true so no rows come back", async () => {
      await GET(get(`Bearer ${SECRET}`));

      expect(mockFrom).toHaveBeenCalledWith("meditations");
      expect(mockSelect).toHaveBeenCalledWith("*", { count: "exact", head: true });
    });

    it("returns 500 when the query errors", async () => {
      mockSelect.mockResolvedValue({ count: null, error: { message: "boom" } });
      const res = await GET(get(`Bearer ${SECRET}`));

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({ ok: false });
    });

    it("does not ping the dead-man's-switch when the query failed", async () => {
      process.env.KEEPALIVE_PING_URL = "https://ping.example/abc";
      mockSelect.mockResolvedValue({ count: null, error: { message: "boom" } });

      await GET(get(`Bearer ${SECRET}`));

      // A ping on failure would defeat the whole point -- the switch would
      // report healthy while the database is unreachable.
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("the dead-man's-switch ping", () => {
    it("is skipped when KEEPALIVE_PING_URL is unset", async () => {
      await GET(get(`Bearer ${SECRET}`));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fires after a successful read when configured", async () => {
      process.env.KEEPALIVE_PING_URL = "https://ping.example/abc";
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      const res = await GET(get(`Bearer ${SECRET}`));

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://ping.example/abc",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("still reports success when the ping itself fails", async () => {
      process.env.KEEPALIVE_PING_URL = "https://ping.example/abc";
      mockFetch.mockRejectedValue(new Error("ping host unreachable"));

      const res = await GET(get(`Bearer ${SECRET}`));

      // The database read is the point; the ping is only the report of it.
      expect(res.status).toBe(200);
    });
  });
});
