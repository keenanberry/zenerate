import { describe, it, expect, vi } from "vitest";
import { changedFields, fieldErrors, saveProfile, toFormValues } from "./form";
import { PROFILE_LIMITS } from "./profile";

const EMPTY = toFormValues({ display_name: null, bio: null, is_public: false });

describe("toFormValues", () => {
  it("reads a new account's empty, private profile as blank fields and the switch off", () => {
    expect(EMPTY).toEqual({ display_name: "", bio: "", is_public: false });
  });
});

describe("changedFields", () => {
  it("is null when nothing changed, stray spaces included", () => {
    expect(changedFields(EMPTY, EMPTY)).toBeNull();
    expect(changedFields(EMPTY, { ...EMPTY, bio: "   " })).toBeNull();
  });

  it("sends only the fields that changed", () => {
    expect(changedFields(EMPTY, { ...EMPTY, display_name: "Ada", is_public: true })).toEqual({
      display_name: "Ada",
      is_public: true,
    });
  });

  it("sends a cleared field as blank text, which the API stores as null", () => {
    const saved = { ...EMPTY, bio: "Breathwork teacher." };
    expect(changedFields(saved, { ...saved, bio: "" })).toEqual({ bio: "" });
  });
});

describe("fieldErrors", () => {
  it("names each field the API would refuse", () => {
    const errors = fieldErrors({
      display_name: "Ada\u0007",
      bio: "a".repeat(PROFILE_LIMITS.bio + 1),
    });
    expect(Object.keys(errors).sort()).toEqual(["bio", "display_name"]);
    expect(errors.bio).toContain(`${PROFILE_LIMITS.bio}`);
    expect(errors.display_name).toBe("Must not contain control characters");
  });

  it("finds nothing wrong with valid fields", () => {
    expect(fieldErrors({ display_name: "Ada", bio: "Breathwork teacher.", is_public: true })).toEqual({});
  });
});

describe("saveProfile", () => {
  const respond = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("PATCHes /api/profile and returns the stored profile", async () => {
    const profile = { id: "u1", display_name: "Ada", is_public: true };
    const fetchImpl = respond(200, profile);
    expect(await saveProfile({ display_name: "Ada", is_public: true }, fetchImpl)).toEqual({ ok: true, profile });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ display_name: "Ada", is_public: true });
  });

  it("passes on the API's message when it refuses", async () => {
    expect(await saveProfile({ bio: "Hi" }, respond(400, { error: "Avatar must be an https:// URL" }))).toEqual({
      ok: false,
      error: "Avatar must be an https:// URL",
    });
  });

  it("says so when the response has no message or the request fails", async () => {
    const bare = vi.fn().mockResolvedValue(new Response("oops", { status: 502 }));
    expect(await saveProfile({ bio: "Hi" }, bare)).toEqual({ ok: false, error: "Couldn't save your profile" });

    const notJson = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await saveProfile({ bio: "Hi" }, notJson)).toEqual({ ok: false, error: "Couldn't save your profile" });

    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await saveProfile({ bio: "Hi" }, offline)).toMatchObject({ ok: false });
  });
});
