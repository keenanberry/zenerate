import { describe, expect, it } from "vitest";
import { SheetDragTracker, dragOutcome, releaseVelocity } from "./sheet-drag";

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

describe("SheetDragTracker", () => {
  const sheet = () => ({ isConnected: true });

  it("follows one pointer from down to release", () => {
    const tracker = new SheetDragTracker();
    expect(tracker.start(sheet(), 1, 100, 0)).toBe(true);
    expect(tracker.move(2, 180, 10)).toBeNull();
    expect(tracker.move(1, 160, 20)?.offset).toBe(60);
    expect(tracker.end(2)).toBeNull();
    expect(tracker.end(1)?.offset).toBe(60);
    expect(tracker.end(1)).toBeNull();
  });

  it("refuses a second pointer while a drag holds a live sheet", () => {
    const tracker = new SheetDragTracker();
    tracker.start(sheet(), 1, 100, 0);
    expect(tracker.start(sheet(), 2, 100, 0)).toBe(false);
  });

  it("drops a drag whose sheet closed from outside before its pointerup", () => {
    // A second finger on the overlay, or a delete finishing, closes the sheet
    // mid-drag; the sheet unmounts and the pointerup never reaches the handle.
    const tracker = new SheetDragTracker();
    const closed = sheet();
    tracker.start(closed, 1, 100, 0);
    tracker.move(1, 140, 10);
    closed.isConnected = false;

    // Reopened, the handle still drags.
    const reopened = sheet();
    expect(tracker.start(reopened, 3, 200, 50)).toBe(true);
    expect(tracker.move(1, 300, 60)).toBeNull();
    expect(tracker.move(3, 230, 60)?.sheet).toBe(reopened);
  });

  it("ends on a lost capture as on a cancel, so the next drag can start", () => {
    const tracker = new SheetDragTracker();
    const live = sheet();
    tracker.start(live, 1, 100, 0);
    expect(tracker.end(1)?.sheet).toBe(live);
    expect(tracker.start(live, 4, 100, 0)).toBe(true);
  });
});
