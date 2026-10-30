import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRemove, mockList } = vi.hoisted(() => ({
  mockRemove: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: { from: () => ({ remove: mockRemove, list: mockList }) },
  }),
}));

import { ownsAudioPath, removeAudio, removeMeditationAudio } from "./storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockRemove.mockResolvedValue({ error: null });
  mockList.mockResolvedValue({ data: [{ name: "r1.mp3" }], error: null });
});

describe("ownsAudioPath", () => {
  it.each([
    ["a render in the meditation's folder", "u/med-1/r.mp3", true],
    ["the legacy root-level file", "med-1.mp3", true],
    ["another user's folder", "victim/med-1/r.mp3", false],
    ["another meditation's folder", "u/med-2/r.mp3", false],
    ["another meditation's legacy file", "med-2.mp3", false],
    ["a path that climbs out", "u/med-1/../../victim/x/r.mp3", false],
    ["a nested path", "u/med-1/a/r.mp3", false],
    ["the folder itself", "u/med-1/", false],
    ["a dot-dot file name", "u/med-1/..", false],
  ])("%s: %s -> %s", (_, path, expected) => {
    expect(ownsAudioPath(path, { userId: "u", meditationId: "med-1" })).toBe(expected);
  });

  it("checks only the meditation's folder when the owner is not known", () => {
    expect(ownsAudioPath("anyone/med-1/r.mp3", { meditationId: "med-1" })).toBe(true);
    expect(ownsAudioPath("anyone/med-2/r.mp3", { meditationId: "med-1" })).toBe(false);
  });
});

describe("removeAudio", () => {
  it("removes the owner's paths and skips anything outside their folder", async () => {
    await removeAudio(["u/med-1/r.mp3", "victim/their-med/r.mp3", null], { userId: "u", meditationId: "med-1" });
    expect(mockRemove).toHaveBeenCalledWith(["u/med-1/r.mp3"]);
  });

  it("removes nothing when every path is foreign", async () => {
    await removeAudio(["victim/their-med/r.mp3"], { userId: "u", meditationId: "med-1" });
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("removeMeditationAudio", () => {
  it("removes the folder's files and owned extras, and skips a forged extra", async () => {
    await removeMeditationAudio("u", "med-1", ["med-1.mp3", "victim/their-med/r.mp3"]);
    expect(mockList).toHaveBeenCalledWith("u/med-1", { limit: 1000 });
    expect(mockRemove).toHaveBeenCalledWith(["u/med-1/r1.mp3", "med-1.mp3"]);
  });
});
