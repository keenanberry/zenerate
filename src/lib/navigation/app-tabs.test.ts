import { describe, expect, it } from "vitest";
import { APP_TABS, activeTab, initials, showBottomBar } from "./app-tabs";

describe("APP_TABS", () => {
  it("lists Library, Discover, Create in that order", () => {
    expect(APP_TABS.map((t) => [t.id, t.href, t.label])).toEqual([
      ["library", "/library", "Library"],
      ["discover", "/discover", "Discover"],
      ["create", "/create", "Create"],
    ]);
  });
});

describe("activeTab", () => {
  it("marks the Library for its pages and for a collection", () => {
    expect(activeTab("/library")).toBe("library");
    expect(activeTab("/library/favorites")).toBe("library");
    expect(activeTab("/collections/abc")).toBe("library");
  });

  it("marks Discover and Create", () => {
    expect(activeTab("/discover")).toBe("discover");
    expect(activeTab("/create")).toBe("create");
  });

  it("marks nothing for Account or a meditation", () => {
    expect(activeTab("/account")).toBeNull();
    expect(activeTab("/meditation/abc")).toBeNull();
  });

  it("does not match a path that only starts with the same letters", () => {
    expect(activeTab("/libraryish")).toBeNull();
    expect(activeTab("/discovery")).toBeNull();
  });
});

describe("showBottomBar", () => {
  it("shows on Create's front door and hides in the studio", () => {
    expect(showBottomBar("/create")).toBe(true);
    expect(showBottomBar("/create/0b6c3a52-1f7e-4d1b-9c4e-2a7d8e9f0a1b")).toBe(false);
  });

  it("shows on the Library", () => {
    expect(showBottomBar("/library")).toBe(true);
  });
});

describe("initials", () => {
  it("takes the first and last words of the display name", () => {
    expect(initials("Keenan Berry", "k@x.com")).toBe("KB");
    expect(initials("Mary Ann Smith", null)).toBe("MS");
  });

  it("trims and uses one letter for one word", () => {
    expect(initials("  ada  ", null)).toBe("A");
  });

  it("falls back to the email's first letter, then a question mark", () => {
    expect(initials(null, "zed@x.com")).toBe("Z");
    expect(initials("   ", "zed@x.com")).toBe("Z");
    expect(initials(null, null)).toBe("?");
  });
});
