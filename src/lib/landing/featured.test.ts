import { describe, expect, it } from "vitest";
import { pickLandingRow, type LandingMeditation } from "./featured";

const m = (id: string): LandingMeditation => ({ id, title: id, tags: [], settings: {} });

describe("pickLandingRow", () => {
  it("shows the house picks once there are three", () => {
    expect(pickLandingRow([m("f1"), m("f2"), m("f3")], [m("n1")])).toEqual({
      source: "featured",
      meditations: [m("f1"), m("f2"), m("f3")],
    });
  });

  it("takes only the first three picks when there are more", () => {
    const row = pickLandingRow([m("f1"), m("f2"), m("f3"), m("f4")], []);
    expect(row?.meditations.map((x) => x.id)).toEqual(["f1", "f2", "f3"]);
  });

  it("falls back to the newest when there are fewer than three picks, without mixing them in", () => {
    expect(pickLandingRow([m("f1"), m("f2")], [m("n1"), m("n2"), m("n3"), m("n4")])).toEqual({
      source: "newest",
      meditations: [m("n1"), m("n2"), m("n3")],
    });
  });

  it("falls back to the newest when nothing is picked yet, even if there are fewer than three", () => {
    expect(pickLandingRow([], [m("n1")])).toEqual({ source: "newest", meditations: [m("n1")] });
  });

  it("is null when there is nothing public to show", () => {
    expect(pickLandingRow([], [])).toBeNull();
    expect(pickLandingRow([m("f1")], [])).toBeNull();
  });
});
