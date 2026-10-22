import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockMeditation, mockUpdate, mockReserve, mockStart, mockServiceUpdate } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockMeditation: vi.fn(),
    mockUpdate: vi.fn(),
    mockReserve: vi.fn(),
    mockStart: vi.fn(),
    mockServiceUpdate: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: mockMeditation }) }),
      update: (values: unknown) => {
        // Records the compare-and-set filters next to the values.
        const filters: Record<string, unknown> = {};
        const chain = {
          eq: (column: string, value: unknown) => ((filters[column] = value), chain),
          is: (column: string, value: unknown) => ((filters[column] = value), chain),
          select: () => mockUpdate(values, filters),
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

const USER = "user-1";

function meditation(overrides: Record<string, unknown>) {
  return {
    data: {
      id: "med-1",
      user_id: USER,
      status: "script_ready",
      settings: {},
      draft_script: null,
      ...overrides,
    },
    error: null,
  };
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

  it("starts a draft render without moving a completed meditation out of completed", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision.", draft_status: null }),
    );
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    expect(mockReserve).toHaveBeenCalledOnce();
    const [values, filters] = mockUpdate.mock.calls[0];
    expect(values).toMatchObject({ draft_status: "processing" });
    expect(values).not.toHaveProperty("status");
    // Settings describe the current version until the draft is promoted.
    expect(values).not.toHaveProperty("settings");
    expect(filters).toEqual({ id: "med-1", status: "completed", draft_status: null });
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it("refuses a second draft render while one is processing, before reserving", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision.", draft_status: "processing" }),
    );
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("takes a free retry of a failed draft render and keeps the meditation completed", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision.", draft_status: "failed" }),
    );
    const res = await post({ meditationId: "med-1", retryOfEventId: "evt-0", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    const [values, filters] = mockUpdate.mock.calls[0];
    expect(values).toMatchObject({ draft_status: "processing" });
    expect(values).not.toHaveProperty("status");
    expect(filters).toEqual({ id: "med-1", status: "completed", draft_status: "failed" });
  });

  it("refuses a completed meditation without a draft with 409, before reserving", async () => {
    mockMeditation.mockResolvedValue(meditation({ status: "completed" }));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(409);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("refuses a second click while the first render is processing", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "processing_audio", draft_script: "A revision." }),
    );
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

  it("puts a draft render's draft_status back, and never touches status, when the start fails", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision.", draft_status: null }),
    );
    mockStart.mockRejectedValue(new Error("HTTP 426"));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(503);
    const [, reverted] = mockServiceUpdate.mock.calls.find(([table]) => table === "meditations")!;
    expect(reverted).toMatchObject({ draft_status: null });
    expect(reverted).not.toHaveProperty("status");
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      "audio_generation_events",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("only takes a retry from a failed render", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision.", draft_status: null }),
    );
    const res = await post({ meditationId: "med-1", retryOfEventId: "evt-0" });
    expect(res.status).toBe(409);
  });
});
