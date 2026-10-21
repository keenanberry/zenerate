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
      update: (values: unknown) => ({
        eq: () => ({ eq: () => ({ select: () => mockUpdate(values) }) }),
      }),
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

  it("accepts a completed meditation that has a draft_script", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision." }),
    );
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(202);
    expect(mockReserve).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing_audio" }),
    );
    expect(mockStart).toHaveBeenCalledOnce();
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

  it("puts a draft render back to completed, not script_ready, when the start fails", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision." }),
    );
    mockStart.mockRejectedValue(new Error("HTTP 426"));
    const res = await post({ meditationId: "med-1", voiceId: "voice-a" });
    expect(res.status).toBe(503);
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      "meditations",
      expect.objectContaining({ status: "completed" }),
    );
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      "audio_generation_events",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("only takes a retry from a failed meditation", async () => {
    mockMeditation.mockResolvedValue(
      meditation({ status: "completed", draft_script: "A revision." }),
    );
    const res = await post({ meditationId: "med-1", retryOfEventId: "evt-0" });
    expect(res.status).toBe(409);
  });
});
