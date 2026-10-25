import { describe, expect, it } from "vitest";
import {
  SIGNUPS_CLOSED,
  authErrorMessage,
  callbackErrorKind,
  loginErrorMessage,
} from "./errors";

describe("authErrorMessage", () => {
  it("says a wrong or expired code in words", () => {
    expect(authErrorMessage({ code: "otp_expired", status: 403 })).toMatch(/wrong or has expired/);
  });

  it("says signups are closed", () => {
    expect(authErrorMessage({ code: "signup_disabled", status: 422 })).toBe(SIGNUPS_CLOSED);
  });

  it.each([
    { code: "over_email_send_rate_limit", status: 429 },
    { code: "over_request_rate_limit", status: 429 },
    { status: 429 },
  ])("says too many requests for %o", (error) => {
    expect(authErrorMessage(error)).toMatch(/Too many codes/);
  });

  it("never shows Supabase's own message", () => {
    const message = authErrorMessage({ code: "unexpected_failure", message: "Database error" });
    expect(message).not.toContain("Database");
    expect(authErrorMessage(new Error("boom"))).not.toContain("boom");
    expect(authErrorMessage(null)).toMatch(/Something went wrong/);
  });
});

describe("callbackErrorKind", () => {
  const kind = (query: string) => callbackErrorKind(new URLSearchParams(query));

  it("is null for a successful callback", () => {
    expect(kind("code=abc&next=%2Fdashboard")).toBeNull();
  });

  it("reads a cancelled Google consent", () => {
    expect(kind("error=access_denied&error_description=The+user+denied")).toBe("google-cancelled");
  });

  it("reads closed signups ahead of the error name", () => {
    expect(kind("error=access_denied&error_code=signup_disabled")).toBe("signups-closed");
    expect(kind("error=invalid_request&error_code=signup_disabled")).toBe("signups-closed");
  });

  it("calls anything else a failed Google sign-in", () => {
    expect(kind("error=server_error&error_code=unexpected_failure")).toBe("google-failed");
  });
});

describe("loginErrorMessage", () => {
  it("maps a known kind and ignores anything else", () => {
    expect(loginErrorMessage("signups-closed")).toBe(SIGNUPS_CLOSED);
    expect(loginErrorMessage("<script>")).toBeNull();
    expect(loginErrorMessage("toString")).toBeNull();
    expect(loginErrorMessage(null)).toBeNull();
  });
});
