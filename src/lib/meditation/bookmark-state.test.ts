import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bookmarkLabel,
  bookmarkOverride,
  bookmarkTooltip,
  canBookmark,
  resetBookmarkOverrides,
  setBookmark,
  setBookmarkOverride,
  signInHref,
  subscribeBookmarks,
} from "./bookmark-state";

afterEach(() => resetBookmarkOverrides());

describe("canBookmark", () => {
  it("allows only a public, finished meditation", () => {
    expect(canBookmark({ is_public: true, status: "completed" })).toBe(true);
    expect(canBookmark({ is_public: false, status: "completed" })).toBe(false);
    expect(canBookmark({ is_public: true, status: "processing_audio" })).toBe(false);
    expect(canBookmark({ status: "completed" })).toBe(false);
  });
});

describe("labels", () => {
  it("says save for later, or saved, distinct from the heart's favorites", () => {
    expect(bookmarkTooltip(false)).toBe("Save for later");
    expect(bookmarkTooltip(true)).toBe("Saved");
    expect(bookmarkLabel(false, "Evening Calm")).toBe("Save Evening Calm for later");
    expect(bookmarkLabel(true, "Evening Calm")).toBe("Remove Evening Calm from saved");
    expect(bookmarkLabel(false)).toBe("Save for later");
    expect(bookmarkLabel(true)).toBe("Remove from saved");
  });
});

describe("signInHref", () => {
  it("returns to the page, query and all", () => {
    expect(signInHref("/discover?q=sleep&tag=rest")).toBe(
      "/login?next=%2Fdiscover%3Fq%3Dsleep%26tag%3Drest",
    );
  });
});

describe("setBookmark", () => {
  const respond = (status: number) =>
    vi.fn().mockResolvedValue(new Response(status === 204 ? null : "{}", { status }));

  it("PUTs to save and DELETEs to remove", async () => {
    const put = respond(201);
    expect(await setBookmark("m1", true, put)).toBe("ok");
    expect(put).toHaveBeenCalledWith("/api/meditations/m1/bookmark", { method: "PUT" });

    const del = respond(204);
    expect(await setBookmark("m1", false, del)).toBe("ok");
    expect(del).toHaveBeenCalledWith("/api/meditations/m1/bookmark", { method: "DELETE" });
  });

  it("reads 401 as signed out, and anything else as an error", async () => {
    expect(await setBookmark("m1", true, respond(401))).toBe("signed_out");
    expect(await setBookmark("m1", true, respond(404))).toBe("error");
    expect(await setBookmark("m1", true, respond(500))).toBe("error");
    expect(await setBookmark("m1", true, vi.fn().mockRejectedValue(new TypeError("offline")))).toBe(
      "error",
    );
  });
});

describe("shared state", () => {
  it("is unset until changed, then tells every subscriber once per change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBookmarks(listener);
    expect(bookmarkOverride("m1")).toBeUndefined();

    setBookmarkOverride("m1", true);
    setBookmarkOverride("m1", true);
    expect(bookmarkOverride("m1")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setBookmarkOverride("m1", false);
    expect(bookmarkOverride("m1")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
