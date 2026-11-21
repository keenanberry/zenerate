import { describe, expect, it } from "vitest";
import { resetPasswordRedirectUrl, safeNextPath } from "./redirect";

describe("resetPasswordRedirectUrl", () => {
  it("routes the email link through the callback to the reset page", () => {
    expect(resetPasswordRedirectUrl("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/auth/callback?next=%2Freset-password"
    );
  });
});

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/reset-password", "/library")).toBe("/reset-password");
  });

  it("falls back when next is missing", () => {
    expect(safeNextPath(null, "/library")).toBe("/library");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "library"])(
    "rejects %s",
    (next) => {
      expect(safeNextPath(next, "/library")).toBe("/library");
    }
  );
});
