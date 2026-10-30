import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { db, uploads, mockWriteFiles } = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  uploads: [] as string[],
  mockWriteFiles: vi.fn(),
}));

/**
 * Just enough of the supabase-js query builder for the workflow and
 * storage.ts: select / insert / update / delete with eq filters, single,
 * maybeSingle, limit, and awaiting the builder itself.
 */
function table(name: string) {
  const filters: Array<[string, unknown]> = [];
  let op:
    | { kind: "select" }
    | { kind: "insert"; row: Row }
    | { kind: "update"; patch: Row }
    | { kind: "delete" } = { kind: "select" };
  let max = Infinity;

  async function run(one: boolean, required: boolean) {
    const rows = (db[name] ??= []);
    const matches = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));
    if (op.kind === "insert") {
      rows.push({ id: `${name}-${rows.length + 1}`, ...op.row });
      return { data: null, error: null };
    }
    if (op.kind === "update") {
      for (const r of matches()) Object.assign(r, op.patch);
      return { data: null, error: null };
    }
    if (op.kind === "delete") {
      const gone = new Set(matches());
      db[name] = rows.filter((r) => !gone.has(r));
      return { data: null, error: null };
    }
    const found = matches().slice(0, max);
    if (!one) return { data: found, error: null };
    if (found.length === 0 && required) return { data: null, error: { message: "no rows" } };
    return { data: found[0] ?? null, error: null };
  }

  const builder = {
    select: () => builder,
    insert: (row: Row) => ((op = { kind: "insert", row }), builder),
    update: (patch: Row) => ((op = { kind: "update", patch }), builder),
    delete: () => ((op = { kind: "delete" }), builder),
    eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
    limit: (n: number) => ((max = n), builder),
    single: () => run(true, true),
    maybeSingle: () => run(true, false),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      run(false, false).then(resolve, reject),
  };
  return builder;
}

// Outside the workflow compiler, "use step" / "use workflow" are inert
// strings, so the workflow runs here as plain async functions. storage.ts is
// real; only its client is the fake above.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: table,
    storage: {
      from: () => ({
        upload: async (path: string, _body: Buffer, opts: { upsert?: boolean }) => {
          if (opts.upsert) throw new Error("uploads must never upsert");
          if (uploads.includes(path)) return { error: { message: "The resource already exists" } };
          uploads.push(path);
          return { error: null };
        },
      }),
    },
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

import { processAudioWorkflow } from "./workflow";
import { AMBIENCES, savedAmbience } from "@/lib/meditation/ambience";

const USER = "user-1";
const CURRENT = "The current script, already narrated.";
const DRAFT = "The revision, made after the audio.";
const OLD_AUDIO = `${USER}/med-1/first-render.mp3`;

function seed(meditation: Row, draft: Row | null = null) {
  db.meditations = [
    {
      id: "med-1",
      user_id: USER,
      settings: { voice: "voice-old" },
      generation_meta: { tts_characters: 10 },
      ...meditation,
    },
  ];
  db.meditation_drafts = draft ? [{ meditation_id: "med-1", ...draft }] : [];
  db.meditation_versions = [];
  db.audio_generation_events = [{ id: "evt-1", status: "pending" }];
}

function meditation() {
  return db.meditations[0];
}

/** A draft render in flight: completed meditation with audio, plus a draft. */
function seedDraftRender() {
  seed(
    { script: CURRENT, audio_path: OLD_AUDIO, status: "completed" },
    { script: DRAFT, render_status: "processing" },
  );
}

function sandboxConfig() {
  const [[files]] = mockWriteFiles.mock.calls;
  return JSON.parse(files[0].content.toString());
}

function narratedText() {
  return sandboxConfig()
    .segments.map((s: { content?: string }) => s.content)
    .join(" ");
}

beforeEach(() => {
  vi.clearAllMocks();
  uploads.length = 0;
  process.env.AUDIO_SANDBOX_SNAPSHOT_ID = "snap_test";
  mockWriteFiles.mockResolvedValue(undefined);
});

describe("processAudioWorkflow", () => {
  it("archives exactly one version and promotes the draft when a draft render completes", async () => {
    seedDraftRender();

    await processAudioWorkflow("med-1", "voice-new", "evt-1");

    expect(narratedText()).toContain(DRAFT);
    expect(narratedText()).not.toContain(CURRENT);

    expect(db.meditation_versions).toHaveLength(1);
    expect(db.meditation_versions[0]).toMatchObject({
      meditation_id: "med-1",
      script: CURRENT,
      audio_path: OLD_AUDIO,
      voice: "voice-old",
      generation_meta: { tts_characters: 10 },
    });

    expect(meditation()).toMatchObject({
      script: DRAFT,
      status: "completed",
      audio_path: uploads[0],
      settings: { voice: "voice-new" },
    });
    expect(db.meditation_drafts).toEqual([]);
    expect(db.audio_generation_events[0].status).toBe("completed");
  });

  it("keeps the meditation and the draft exactly as they were when a draft render fails", async () => {
    seedDraftRender();
    const before = { ...meditation() };
    mockWriteFiles.mockRejectedValue(new Error("sandbox down"));

    await expect(processAudioWorkflow("med-1", "voice-new", "evt-1")).rejects.toThrow();

    // Only the draft's render_status moves: the public page keeps playing the
    // current version, status never leaves completed, and nothing on the
    // meditation row (which anon can read) changes at all.
    expect(meditation()).toEqual(before);
    expect(db.meditation_drafts).toEqual([
      expect.objectContaining({ script: DRAFT, render_status: "failed" }),
    ]);
    expect(db.meditation_versions).toHaveLength(0);
    expect(uploads).toHaveLength(0);
    expect(db.audio_generation_events[0].status).toBe("failed");
  });

  it("renders the script and archives nothing when there is no draft", async () => {
    seed({ script: CURRENT, audio_path: null, status: "processing_audio" });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(narratedText()).toContain(CURRENT);
    expect(meditation()).toMatchObject({
      script: CURRENT,
      status: "completed",
      audio_path: uploads[0],
    });
    expect(db.meditation_versions).toHaveLength(0);
  });

  it("mixes the bed saved in settings.music at its saved volume", async () => {
    seed({
      script: CURRENT,
      audio_path: null,
      status: "processing_audio",
      settings: { voice: "voice-old", music: "rain", volume: 0.3 },
    });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(sandboxConfig()).toMatchObject({
      backgroundMusic: "sounds/ambient/rain.mp3",
      musicVolume: 0.3,
    });
  });

  it("mixes nothing when no bed was chosen, or the saved one is unknown", async () => {
    seed({
      script: CURRENT,
      audio_path: null,
      status: "processing_audio",
      settings: { music: "whale-song" },
    });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(sandboxConfig().backgroundMusic).toBeNull();
  });

  // Brown noise was a bed until task 44 replaced it with space. A meditation
  // saved with it re-renders as narration alone instead of failing.
  it("mixes nothing for a retired bed, brown-noise", async () => {
    seed({
      script: CURRENT,
      audio_path: null,
      status: "processing_audio",
      settings: { voice: "voice-old", music: "brown-noise", volume: 0.5 },
    });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(savedAmbience("brown-noise")).toBeNull();
    expect(sandboxConfig().backgroundMusic).toBeNull();
    expect(meditation().status).toBe("completed");
  });

  it("mixes a draft render's chosen bed and saves it only on promotion", async () => {
    seedDraftRender();

    await processAudioWorkflow("med-1", "voice-new", "evt-1", "ocean");

    expect(sandboxConfig()).toMatchObject({
      backgroundMusic: "sounds/ambient/ocean.mp3",
      musicVolume: AMBIENCES.ocean.volume,
    });
    expect(meditation().settings).toEqual({
      voice: "voice-new",
      music: "ocean",
      volume: AMBIENCES.ocean.volume,
    });
  });

  it("marks a first render failed when it fails", async () => {
    seed({ script: CURRENT, audio_path: null, status: "processing_audio" });
    mockWriteFiles.mockRejectedValue(new Error("sandbox down"));

    await expect(processAudioWorkflow("med-1", null, "evt-1")).rejects.toThrow();

    expect(meditation().status).toBe("failed");
  });

  it("uploads every render to a new path under <user_id>/<meditation_id>/", async () => {
    seed({ script: CURRENT, audio_path: null, status: "processing_audio" });
    await processAudioWorkflow("med-1", null, "evt-1");
    const first = meditation().audio_path as string;

    db.meditation_drafts = [{ meditation_id: "med-1", script: DRAFT, render_status: "processing" }];
    await processAudioWorkflow("med-1", null, "evt-2");
    const second = meditation().audio_path as string;

    expect(first).toMatch(/^user-1\/med-1\/[0-9a-f-]{36}\.mp3$/);
    expect(second).toMatch(/^user-1\/med-1\/[0-9a-f-]{36}\.mp3$/);
    expect(second).not.toBe(first);
    expect(uploads).toEqual([first, second]);
    // The first render's file is now the archived version's, untouched.
    expect(db.meditation_versions).toEqual([
      expect.objectContaining({ audio_path: first, script: CURRENT }),
    ]);
  });

  // The owner can still write script, settings and the draft after the
  // generate route checked them, so the workflow checks what it hands the
  // sandbox itself.
  describe("what reaches the sandbox", () => {
    it.each([
      ["a 999-minute silence", { script: "Breathe.\n*[SILENCE: 999 minutes]*" }],
      ["a sound marker that names a path", { script: "Breathe.\n*[SOUND: ../config.json]*" }],
      ["a 50,000-character script", { script: "Breathe. ".repeat(5556) }],
      ["a filter-graph volume", { script: CURRENT, settings: { music: "rain", volume: "1,anull" } }],
    ])("fails the render without starting a sandbox on %s", async (_, row) => {
      seed({ audio_path: null, status: "processing_audio", ...row });

      await expect(processAudioWorkflow("med-1", "voice-a", "evt-1")).rejects.toThrow();

      expect(mockWriteFiles).not.toHaveBeenCalled();
      expect(meditation().status).toBe("failed");
    });

    it("checks the draft it renders", async () => {
      seedDraftRender();
      db.meditation_drafts[0].script = "Breathe.\n*[SILENCE: 999 minutes]*";

      await expect(processAudioWorkflow("med-1", "voice-a", "evt-1")).rejects.toThrow();
      expect(mockWriteFiles).not.toHaveBeenCalled();
    });

    it("drops a sound that is not in the catalog", async () => {
      seed({ script: `${CURRENT}\n*[SOUND: kazoo.mp3]*`, audio_path: null, status: "processing_audio" });
      await processAudioWorkflow("med-1", "voice-a", "evt-1");
      expect(sandboxConfig().segments).toEqual([{ type: "speech", content: CURRENT }]);
    });

    it("clamps a saved volume into [0, 1]", async () => {
      seed({
        script: CURRENT,
        audio_path: null,
        status: "processing_audio",
        settings: { music: "rain", volume: 40 },
      });
      await processAudioWorkflow("med-1", "voice-a", "evt-1");
      expect(sandboxConfig().musicVolume).toBe(1);
    });
  });
});
