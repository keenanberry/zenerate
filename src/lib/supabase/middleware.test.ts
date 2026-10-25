import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieMethods = {
  setAll: (cookies: { name: string; value: string; options: object }[]) => void;
};

// Each test sets what getClaims finds and whether reading the session refreshes it.
let signedIn = false;
let refreshed: { name: string; value: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookieMethods }) => ({
    auth: {
      getClaims: async () => {
        if (refreshed) cookies.setAll([{ ...refreshed, options: { path: "/" } }]);
        return { data: signedIn ? { claims: { sub: "user-1" } } : null, error: null };
      },
    },
  }),
}));

const { updateSession } = await import("./middleware");

function request(path: string, method = "GET") {
  return new NextRequest(new URL(path, "http://127.0.0.1:3000"), {
    method,
    headers: { host: "127.0.0.1:3000" },
  });
}

beforeEach(() => {
  signedIn = false;
  refreshed = null;
});

describe("updateSession", () => {
  it("lets a signed-out visitor reach /login", async () => {
    const response = await updateSession(request("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a signed-in visitor from /login to the dashboard", async () => {
    signedIn = true;
    const response = await updateSession(request("/login"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/dashboard");
  });

  it("honours a same-origin next, query included", async () => {
    signedIn = true;
    const response = await updateSession(
      request(`/login?next=${encodeURIComponent("/collections/abc?view=grid")}`)
    );
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/collections/abc?view=grid"
    );
  });

  it("ignores an off-site next", async () => {
    signedIn = true;
    const response = await updateSession(request("/login?next=//evil.example"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/dashboard");
  });

  it("lets a POST to /login through, so server actions still run", async () => {
    signedIn = true;
    const response = await updateSession(request("/login", "POST"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("gates nothing else", async () => {
    for (const path of ["/discover", "/meditation/abc", "/dashboard", "/api/voices", "/reset-password"]) {
      const response = await updateSession(request(path));
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("passes a refreshed session on, redirect or not", async () => {
    refreshed = { name: "sb-test-auth-token", value: "fresh" };
    const through = await updateSession(request("/discover"));
    expect(through.cookies.get("sb-test-auth-token")?.value).toBe("fresh");

    signedIn = true;
    const redirect = await updateSession(request("/login"));
    expect(redirect.headers.get("location")).toBe("http://127.0.0.1:3000/dashboard");
    expect(redirect.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
  });
});
