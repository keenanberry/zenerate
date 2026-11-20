import { describe, it, expect } from "vitest";
import { parseProfileUpdate, PROFILE_LIMITS } from "./profile";

describe("parseProfileUpdate", () => {
  it("accepts the three fields, trimmed", () => {
    const result = parseProfileUpdate({
      display_name: "  Ada  ",
      bio: " Breathwork teacher. ",
      avatar_url: "https://example.com/a.png",
    });
    expect(result).toEqual({
      ok: true,
      update: { display_name: "Ada", bio: "Breathwork teacher.", avatar_url: "https://example.com/a.png" },
    });
  });

  it("keeps only the fields sent, so a partial update leaves the rest alone", () => {
    expect(parseProfileUpdate({ bio: "Hi" })).toEqual({ ok: true, update: { bio: "Hi" } });
  });

  it("clears a field sent as null or as blank text", () => {
    expect(parseProfileUpdate({ display_name: null, bio: "   ", avatar_url: "" })).toEqual({
      ok: true,
      update: { display_name: null, bio: null, avatar_url: null },
    });
  });

  it("refuses a body with nothing to change", () => {
    expect(parseProfileUpdate({})).toMatchObject({ ok: false });
  });

  it("refuses a body that is not an object", () => {
    expect(parseProfileUpdate(null)).toMatchObject({ ok: false });
    expect(parseProfileUpdate("hi")).toMatchObject({ ok: false });
    expect(parseProfileUpdate([])).toMatchObject({ ok: false });
  });

  it("refuses columns the owner may not write", () => {
    expect(parseProfileUpdate({ id: "someone-else" })).toMatchObject({ ok: false });
    expect(parseProfileUpdate({ bio: "Hi", created_at: "2020-01-01" })).toMatchObject({ ok: false });
  });

  it("refuses text over the limits", () => {
    expect(parseProfileUpdate({ display_name: "a".repeat(PROFILE_LIMITS.displayName + 1) })).toMatchObject({
      ok: false,
    });
    expect(parseProfileUpdate({ bio: "a".repeat(PROFILE_LIMITS.bio + 1) })).toMatchObject({ ok: false });
    expect(parseProfileUpdate({ bio: "a".repeat(PROFILE_LIMITS.bio) })).toMatchObject({ ok: true });
  });

  it("refuses an avatar that is not an https URL", () => {
    for (const avatar_url of ["http://example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AA", "not a url"]) {
      expect(parseProfileUpdate({ avatar_url })).toMatchObject({ ok: false });
    }
  });

  it("refuses a field of the wrong type", () => {
    expect(parseProfileUpdate({ display_name: 42 })).toMatchObject({ ok: false });
  });
});
