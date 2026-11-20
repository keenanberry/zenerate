import { describe, it, expect, vi } from "vitest";
import { getMeditationAuthors, MAX_AUTHOR_LOOKUP } from "./authors";

function client(rows: unknown[] = [], error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data: rows, error }) };
}

describe("getMeditationAuthors", () => {
  it("keys each public author by meditation id", async () => {
    const supabase = client([
      { meditation_id: "m1", author_id: "u1", display_name: "Ada", avatar_url: null },
    ]);
    const authors = await getMeditationAuthors(supabase as never, ["m1", "m2"]);

    expect(supabase.rpc).toHaveBeenCalledWith("meditation_authors", { p_meditation_ids: ["m1", "m2"] });
    expect(authors.get("m1")).toEqual({ id: "u1", display_name: "Ada", avatar_url: null });
    expect(authors.has("m2")).toBe(false);
  });

  it("makes no call for no ids, and dedupes and batches the rest", async () => {
    const supabase = client();
    await getMeditationAuthors(supabase as never, []);
    expect(supabase.rpc).not.toHaveBeenCalled();

    const ids = Array.from({ length: MAX_AUTHOR_LOOKUP + 1 }, (_, i) => `m${i}`);
    await getMeditationAuthors(supabase as never, [...ids, "m0"]);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[1][1]).toEqual({ p_meditation_ids: [`m${MAX_AUTHOR_LOOKUP}`] });
  });

  it("throws when the lookup fails", async () => {
    await expect(getMeditationAuthors(client([], { message: "boom" }) as never, ["m1"])).rejects.toThrow("boom");
  });
});
