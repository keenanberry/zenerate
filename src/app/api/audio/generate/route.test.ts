import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockMeditation, mockDraft, mockUpdate, mockReserve, mockStart, mockServiceUpdate } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockMeditation: vi.fn(),
    mockDraft: vi.fn(),
    mockUpdate: vi.fn(),
    mockReserve: vi.fn(),
    mockStart: vi.fn(),
    mockServiceUpdate: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: mockMeditation, maybeSingle: mockDraft }) }),
      update: (values: unknown) => {
        // Records the compare-and-set filters next to the table and values.
        const filters: Record<string, unknown> = {};
        const chain = {
          eq: (column: string, value: unknown) => ((filters[column] = value), chain),
          is: (column: string, value: unknown) => ((filters[column] = value), chain),
          select: () => mockUpdate(table, values, filters),
        };
        return chain;
      },
    }),
  }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (values: unknown) => ({ eq: () => mockServiceUpdate(table, values) }),
    }),
  }),
}));
vi.mock("@/lib/audio/quota", () => ({
  reserveAudioGeneration: mockReserve,
  getQuotaConfig: () => ({ perUserCap: 3, globalCap: 25 }),
}));
vi.mock("workflow/api", () => ({ start: mockStart }));
vi.mock("@/lib/audio/workflow", () => ({ processAudioWorkflow: () => {} }));
vi.mock("@/lib/voices/server", () => ({
  getVoices: async () => [{ voiceId: "voice-a" }],
}));

import { POST } from "./route";
import { AMBIENCES } from "@/lib/meditation/ambience";

const USER = "user-1";

function meditation(overrides: Record<string, unknown>) {
  return {
    data: {
      id: "med-1",
      user_id: USER,
      status: "script_ready",
      settings: {},
      ...overrides,
    },
    error: null,
  };
}

/** A revision waiting in meditation_drafts, with its render's state. */
function withDraft(renderStatus: "processing" | "failed" | null) {
  mockDraft.mockResolvedValue({
    data: { script: "A revision.", render_status: renderStatus },
    error: null,
  });
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/audio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: USER } } });
  mockDraft.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockResolvedValue({ data: [{ id: "med-1" }], error: null });
  mockServiceUpdate.mockResolvedValue({ error: null });
  mockReserve.mockResolvedValue({ ok: true, eventId: "evt-1" });
  mockStart.mockResolvedValue({ runId: "run-1" });
});

describe("POST /api/audio/generate", () => {
  it("starts a script_ready meditation", async () => {
    mockMeditation.mockResolvedValue(meditation({}));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it("saves a chosen ambience with its default volume and hands it to the workflow", async () => {
    mockMeditation.mockResolvedValue(meditation({ settings: { duration: 10 } }));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a", ambience: "rain" });
    expect(res.status).toBe(202);
    const [, values] = mockUpdate.mock.calls[0];
    expect(values).toMatchObject({
      settings: { duration: 10, voice: "voice-a", music: "rain", volume: AMBIENCES.rain.volume },
    });
    expect(mockStart.mock.calls[0][1]).toEqual(["med-1", "voice-a", "evt-1", "rain"]);
  });

  it("saves None as a choice, so a re-render keeps it", async () => {
    mockMeditation.mockResolvedValue(meditation({}));
    await post({ meditationId: "med-1", voiceId: "voice-a", ambience: "none" });
    const [, values] = mockUpdate.mock.calls[0];
    expect(values).toMatchObject({ settings: { music: "none", volume: 0 } });
  });

  it("rejects an ambience that is not in the catalog, before reserving", async () => {
    mockMeditation.mockResolvedValue(meditation({}));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a", ambience: "sounds/../x.mp3" });
    expect(res.status).toBe(400);
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("passes a draft render's ambience to the workflow without saving it yet", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft(null);
    await post({ meditationId: "med-1", voiceId: "voice-a", ambience: "forest" });
    const [, values] = mockUpdate.mock.calls[0];
    expect(values).not.toHaveProperty("settings");
    expect(mockStart.mock.calls[0][1]).toEqual(["med-1", "voice-a", "evt-1", "forest"]);
  });

  it("starts a draft render without moving a completed meditation out of completed", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft(null);
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    expect(mockReserve).toHaveBeenCalledOnce();
    // Only the owner-only draft moves: nothing on the meditation row, which
    // anon can read, says a render is under way.
    expect(mockUpdate).toHaveBeenCalledOnce();
    const [table, values, filters] = mockUpdate.mock.calls[0];
    expect(table).toBe("meditation_drafts");
    expect(values).toMatchObject({ render_status: "processing" });
    // Settings describe the current version until the draft is promoted.
    expect(values).not.toHaveProperty("settings");
    expect(filters).toEqual({ meditation_id: "med-1", render_status: null });
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it("refuses a second draft render while one is processing, before reserving", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft("processing");
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("takes a free retry of a failed draft render and keeps the meditation completed", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft("failed");
    const res = await post({ meditationId: "med-1", retryOfEventId: "evt-0", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    const [table, values, filters] = mockUpdate.mock.calls[0];
    expect(table).toBe("meditation_drafts");
    expect(values).toMatchObject({ render_status: "processing" });
    expect(filters).toEqual({ meditation_id: "med-1", render_status: "failed" });
  });

  it("refuses a completed meditation without a draft with 409, before reserving", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("refuses a second click while the first render is processing", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "processing_audio" }));
    withDraft(null);
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("gives the reservation back when another request flipped the status first", async () => {
    mockMeditation.mockResolvedValue(meditation({}));
    mockUpdate.mockResolvedValue({ data: [], error: null });
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      "audio_generation_events",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("puts a draft render's render_status back, and never touches the meditation, when the start fails", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft(null);
    mockStart.mockRejectedValue(new Error("HTTP 426"));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(503);
    const [, reverted] = mockServiceUpdate.mock.calls.find(([table]) => table === "meditation_drafts")!;
    expect(reverted).toMatchObject({ render_status: null });
    expect(mockServiceUpdate).not.toHaveBeenCalledWith("meditations", expect.anything());
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      "audio_generation_events",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("only takes a retry from a failed render", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    withDraft(null);
    const res = await post({ meditationId: "med-1", retryOfEventId: "evt-0" });
    expect(res.status).toBe(409);
  });
});
