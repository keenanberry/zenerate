import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMeditation, mockWriteFiles, mockUpdateStatus } = vi.hoisted(() => ({
  mockMeditation: vi.fn(),
  mockWriteFiles: vi.fn(),
  mockUpdateStatus: vi.fn(),
}));

// Outside the workflow compiler, "use step" / "use workflow" are inert
// strings, so the workflow runs here as plain async functions.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockMeditation }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: async () => ({
      writeFiles: mockWriteFiles,
      runCommand: async () => ({ exitCode: 0 }),
      readFileToBuffer: async ({ path }: { path: string }) =>
        path === "output.mp3" ? Buffer.from("mp3") : null,
      stop: async () => {},
    }),
  },
}));
vi.mock("./storage", () => ({
  uploadAudio: async (id: string) => `${id}.mp3`,
  updateMeditationStatus: mockUpdateStatus,
}));

import { processAudioWorkflow } from "./workflow";

const CURRENT = "The current script, already narrated.";
const DRAFT = "The revision, made after the audio.";

function narratedText() {
  const [[files]] = mockWriteFiles.mock.calls;
  const config = JSON.parse(files[0].content.toString());
  return config.segments.map((s: { content?: string }) => s.content).join(" ");
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUDIO_SANDBOX_SNAPSHOT_ID = "snap_test";
  mockUpdateStatus.mockResolvedValue(undefined);
});

describe("processAudioWorkflow", () => {
  it("renders draft_script when there is one, and makes it the script on success", async () => {
    mockMeditation.mockResolvedValue({
      data: { script: CURRENT, draft_script: DRAFT, settings: {} },
      error: null,
    });

    await processAudioWorkflow("med-1", "voice-a", "evt-1");

    expect(narratedText()).toContain(DRAFT);
    expect(narratedText()).not.toContain(CURRENT);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "med-1",
      "completed",
      "med-1.mp3",
      expect.anything(),
      { script: DRAFT, draft_script: null },
    );
  });

  it("renders the script and leaves it alone when there is no draft", async () => {
    mockMeditation.mockResolvedValue({
      data: { script: CURRENT, draft_script: null, settings: {} },
      error: null,
    });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(narratedText()).toContain(CURRENT);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "med-1",
      "completed",
      "med-1.mp3",
      expect.anything(),
      undefined,
    );
  });

  it("keeps the draft when the render fails", async () => {
    mockMeditation.mockResolvedValue({
      data: { script: CURRENT, draft_script: DRAFT, settings: {} },
      error: null,
    });
    mockWriteFiles.mockRejectedValue(new Error("sandbox down"));

    await expect(processAudioWorkflow("med-1", null, "evt-1")).rejects.toThrow();

    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).toHaveBeenCalledWith("med-1", "failed");
  });
});
