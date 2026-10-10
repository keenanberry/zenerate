import { describe, expect, it, vi } from "vitest";
import { startRunOrRevert } from "./start-run";

describe("startRunOrRevert", () => {
  it("returns the run id and leaves the revert untouched when the start succeeds", async () => {
    const revert = vi.fn().mockResolvedValue(undefined);
    const result = await startRunOrRevert({
      start: async () => ({ runId: "wrun_1" }),
      revert,
    });
    expect(result).toEqual({ ok: true, runId: "wrun_1" });
    expect(revert).not.toHaveBeenCalled();
  });

  it("runs the revert and reports the error when the start throws", async () => {
    const revert = vi.fn().mockResolvedValue(undefined);
    const boom = new Error("HTTP 403 from the workflow API");
    const result = await startRunOrRevert({
      start: async () => {
        throw boom;
      },
      revert,
    });
    expect(result).toEqual({ ok: false, error: boom });
    expect(revert).toHaveBeenCalledTimes(1);
  });

  it("still reports the start error when the revert itself fails", async () => {
    const boom = new Error("start failed");
    const result = await startRunOrRevert({
      start: async () => {
        throw boom;
      },
      revert: async () => {
        throw new Error("revert failed too");
      },
    });
    expect(result).toEqual({ ok: false, error: boom });
  });
});
