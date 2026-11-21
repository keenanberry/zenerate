/**
 * sharp is a native module reached from the chat route (tools.ts → store.ts).
 * It must load only when a cover is encoded, so a binary that fails to load
 * on the server fails that one cover, never the whole studio.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioToolContext } from "@/lib/chat/tools";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("sharp");
  vi.doUnmock("@/lib/cover/generate");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("sharp is loaded lazily", () => {
  it("is not imported when the studio tools (and so the chat route) load", async () => {
    let loaded = false;
    vi.doMock("sharp", () => {
      loaded = true;
      return { default: () => ({}) };
    });
    await import("@/lib/chat/tools");
    await import("@/lib/cover/store");
    expect(loaded).toBe(false);
  });

  it("turns a sharp that fails to load into an ordinary makeCover failure, releasing the generation", async () => {
    const rpcs: string[] = [];
    vi.doMock("sharp", () => {
      throw new Error('Could not load the "sharp" module using the linux-x64 runtime');
    });
    vi.doMock("@/lib/cover/generate", () => ({
      generateCover: async () => ({ bytes: new Uint8Array([1]), mediaType: "image/jpeg" }),
    }));
    vi.doMock("@/lib/supabase/service-role", () => ({
      createClient: () => ({
        rpc: async (name: string) => {
          rpcs.push(name);
          return { data: name === "reserve_cover_generation" ? 1 : null, error: null };
        },
      }),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { studioTools } = await import("@/lib/chat/tools");
    const rows: Record<string, Record<string, unknown>> = {
      chats: { meditation_id: "6f1c2a9e-3b7d-4e21-9a0c-5d8f7e6b1a24" },
      meditations: { id: "6f1c2a9e-3b7d-4e21-9a0c-5d8f7e6b1a24" },
    };
    const supabase = {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data: rows[table], error: null }),
        };
        return chain;
      },
    } as unknown as StudioToolContext["supabase"];
    const execute = studioTools.makeCover.execute as unknown as (
      input: { subject: string },
      options: { toolCallId: string; messages: []; context: StudioToolContext },
    ) => Promise<unknown>;

    await expect(
      execute(
        { subject: "A still lake at dawn." },
        { toolCallId: "c1", messages: [], context: { supabase, userId: "user-1", chatId: "chat-1" } },
      ),
    ).rejects.toThrow(/could not be made this time/);
    expect(rpcs).toEqual(["reserve_cover_generation", "release_cover_generation"]);
  });
});
