import { describe, expect, it } from "vitest";
import { dragOutcome, releaseVelocity } from "./sheet-drag";

describe("dragOutcome", () => {
  it("closes once the sheet is dragged past a third of its height", () => {
    expect(dragOutcome({ offset: 140, height: 400, velocity: 0 })).toBe("close");
    expect(dragOutcome({ offset: 120, height: 400, velocity: 0 })).toBe("restore");
  });

  it("closes on a fast downward flick that has moved the sheet", () => {
    expect(dragOutcome({ offset: 40, height: 400, velocity: 0.8 })).toBe("close");
  });

  it("does not close on a flick that has barely moved it", () => {
    expect(dragOutcome({ offset: 10, height: 400, velocity: 2 })).toBe("restore");
  });

  it("restores a sheet dragged up", () => {
    expect(dragOutcome({ offset: -50, height: 400, velocity: 0 })).toBe("restore");
  });
});

describe("releaseVelocity", () => {
  it("measures the finger over its last stretch, not the whole drag", () => {
    // A slow start, then 60px in the last 60ms: 1px/ms at release.
    const samples = [
      { y: 0, t: 0 },
      { y: 10, t: 300 },
      { y: 40, t: 330 },
      { y: 70, t: 360 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(1);
  });

  it("is zero with fewer than two samples or no time between them", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ y: 5, t: 10 }])).toBe(0);
    expect(releaseVelocity([{ y: 5, t: 10 }, { y: 9, t: 10 }])).toBe(0);
  });

  it("is negative for a finger moving up", () => {
    expect(releaseVelocity([{ y: 100, t: 0 }, { y: 50, t: 50 }])).toBeCloseTo(-1);
  });
});
