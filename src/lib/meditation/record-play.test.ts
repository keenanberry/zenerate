import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockInsert, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      mockFrom(table);
      return { insert: mockInsert };
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audio/signed-url", () => ({
  hydrateAudioUrl: vi.fn(),
  hydrateAudioUrls: vi.fn(),
}));

import { watchPlays } from "@/components/use-play-tracking";
import { recordPlay } from "./actions";

/** The player's element, reduced to what watchPlays reads. */
class FakeMedia extends EventTarget {
  paused = true;
  currentTime = 0;
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  listen(seconds: number) {
    for (let i = 0; i < seconds * 4; i++) {
      this.currentTime += 0.25;
      this.dispatchEvent(new Event("timeupdate"));
    }
  }
  end() {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
    this.currentTime = 0;
  }
}

/** Two full plays and one abandoned at 10 s, with the player recording. */
async function listenThreeTimes() {
  const media = new FakeMedia();
  const pending: Promise<boolean>[] = [];
  watchPlays(media, () => pending.push(recordPlay("med-1")));
  media.play();
  media.listen(45);
  media.end();
  media.play();
  media.listen(45);
  media.end();
  media.play();
  media.listen(10);
  return Promise.all(pending);
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockReset();
});

describe("recordPlay", () => {
  it("writes nothing for a signed-out play", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const results = await listenThreeTimes();

    expect(results).toEqual([false, false]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("writes one row per signed-in play past 30 seconds", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const results = await listenThreeTimes();

    expect(results).toEqual([true, true]);
    expect(mockFrom).toHaveBeenCalledWith("meditation_plays");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert).toHaveBeenCalledWith({ meditation_id: "med-1", user_id: "user-1" });
  });

  it("reports a refused insert without throwing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockInsert.mockResolvedValue({ error: { message: "new row violates row-level security" } });

    await expect(recordPlay("private")).resolves.toBe(false);
  });
});
