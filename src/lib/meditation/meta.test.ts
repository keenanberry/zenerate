import { describe, expect, it } from "vitest";
import { metaLine } from "./meta";

const now = new Date("2026-10-23T12:00:00Z");

describe("metaLine", () => {
  it("joins the first known tag, the length and the date", () => {
    expect(
      metaLine(
        { tags: ["grounding", "sleep"], settings: { duration: 10 }, created_at: "2026-10-22T09:00:00Z" },
        { now },
      ),
    ).toBe("Grounding · 10 min · Yesterday");
  });

  it("skips a slug outside the vocabulary and missing parts", () => {
    expect(metaLine({ tags: ["not-a-tag", "sleep"], settings: {} }, { now })).toBe("Sleep");
    expect(metaLine({ tags: [], settings: { duration: 5 } }, { now })).toBe("5 min");
    expect(metaLine({ tags: null, settings: null }, { now })).toBe("");
  });

  it("leaves the date out unless there is one", () => {
    expect(metaLine({ tags: ["focus"], settings: { duration: 8 } }, { now })).toBe("Focus · 8 min");
  });

  it("dates this week relatively and older ones by month and day", () => {
    const at = (iso: string) => metaLine({ tags: [], settings: {}, created_at: iso }, { now });
    expect(at("2026-10-23T08:00:00Z")).toBe("Today");
    expect(at("2026-10-20T08:00:00Z")).toBe("3d ago");
    expect(at("2026-10-01T08:00:00Z")).toBe("Oct 1");
  });
});
