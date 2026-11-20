import { describe, it, expect, vi } from "vitest";
import { getRatingStats, MAX_RATING_LOOKUP, parseRating } from "./ratings";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function client(rows: unknown[] = [], error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data: rows, error }) };
}

describe("parseRating", () => {
  it("accepts a whole number from 1 to 5", () => {
    for (const stars of [1, 2, 3, 4, 5]) expect(parseRating({ stars })).toEqual({ ok: true, stars });
  });

  it("refuses anything else with a message", () => {
    for (const body of [{ stars: 0 }, { stars: 6 }, { stars: 2.5 }, { stars: "3" }, {}, null, { stars: 3, extra: 1 }]) {
      const result = parseRating(body);
      expect(result.ok, JSON.stringify(body)).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/./);
    }
  });
});

describe("getRatingStats", () => {
  it("keys average and count by meditation id, as numbers", async () => {
    const supabase = client([{ meditation_id: id(1), average: "4.3", count: "3" }]);
    const stats = await getRatingStats(supabase as never, [id(1), id(2)]);

    expect(supabase.rpc).toHaveBeenCalledWith("meditation_rating_stats", { p_meditation_ids: [id(1), id(2)] });
    expect(stats.get(id(1))).toEqual({ average: 4.3, count: 3 });
    expect(stats.has(id(2))).toBe(false);
  });

  it("makes no call for no ids, and dedupes, drops malformed ids and batches the rest", async () => {
    const supabase = client();
    await getRatingStats(supabase as never, ["not-a-uuid"]);
    expect(supabase.rpc).not.toHaveBeenCalled();

    const ids = Array.from({ length: MAX_RATING_LOOKUP + 1 }, (_, i) => id(i));
    await getRatingStats(supabase as never, [...ids, id(0)]);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[1][1]).toEqual({ p_meditation_ids: [id(MAX_RATING_LOOKUP)] });
  });

  it("throws when the lookup fails", async () => {
    await expect(getRatingStats(client([], { message: "boom" }) as never, [id(1)])).rejects.toThrow("boom");
  });
});
