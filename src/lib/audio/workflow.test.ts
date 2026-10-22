import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { db, uploads, mockWriteFiles } = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  uploads: [] as string[],
  mockWriteFiles: vi.fn(),
}));

/**
 * Just enough of the supabase-js query builder for the workflow and
 * storage.ts: select / insert / update with eq filters, single, maybeSingle,
 * limit, and awaiting the builder itself.
 */
function table(name: string) {
  const filters: Array<[string, unknown]> = [];
  let op: { kind: "select" } | { kind: "insert"; row: Row } | { kind: "update"; patch: Row } = {
    kind: "select",
  };
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
    const found = matches().slice(0, max);
    if (!one) return { data: found, error: null };
    if (found.length === 0 && required) return { data: null, error: { message: "no rows" } };
    return { data: found[0] ?? null, error: null };
  }

  const builder = {
    select: () => builder,
    insert: (row: Row) => ((op = { kind: "insert", row }), builder),
    update: (patch: Row) => ((op = { kind: "update", patch }), builder),
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

const USER = "user-1";
const CURRENT = "The current script, already narrated.";
const DRAFT = "The revision, made after the audio.";
const OLD_AUDIO = `${USER}/med-1/first-render.mp3`;

function seed(meditation: Row) {
  db.meditations = [
    {
      id: "med-1",
      user_id: USER,
      settings: { voice: "voice-old" },
      generation_meta: { tts_characters: 10 },
      draft_status: null,
      ...meditation,
    },
  ];
  db.meditation_versions = [];
  db.audio_generation_events = [{ id: "evt-1", status: "pending" }];
}

function meditation() {
  return db.meditations[0];
}

function narratedText() {
  const [[files]] = mockWriteFiles.mock.calls;
  const config = JSON.parse(files[0].content.toString());
  return config.segments.map((s: { content?: string }) => s.content).join(" ");
}

beforeEach(() => {
  vi.clearAllMocks();
  uploads.length = 0;
  process.env.AUDIO_SANDBOX_SNAPSHOT_ID = "snap_test";
  mockWriteFiles.mockResolvedValue(undefined);
});

describe("processAudioWorkflow", () => {
  it("archives exactly one version and promotes the draft when a draft render completes", async () => {
    seed({
      script: CURRENT,
      draft_script: DRAFT,
      audio_path: OLD_AUDIO,
      status: "completed",
      draft_status: "processing",
    });

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
      draft_script: null,
      draft_status: null,
      status: "completed",
      audio_path: uploads[0],
      settings: { voice: "voice-new" },
    });
    expect(db.audio_generation_events[0].status).toBe("completed");
  });

  it("keeps the meditation and the draft exactly as they were when a draft render fails", async () => {
    seed({
      script: CURRENT,
      draft_script: DRAFT,
      audio_path: OLD_AUDIO,
      status: "completed",
      draft_status: "processing",
    });
    const before = { ...meditation(), draft_status: "failed" };
    mockWriteFiles.mockRejectedValue(new Error("sandbox down"));

    await expect(processAudioWorkflow("med-1", "voice-new", "evt-1")).rejects.toThrow();

    // Only draft_status moves (and updated_at): the public page keeps playing
    // the current version, and status never leaves completed.
    expect({ ...meditation(), updated_at: undefined }).toEqual({ ...before, updated_at: undefined });
    expect(db.meditation_versions).toHaveLength(0);
    expect(uploads).toHaveLength(0);
    expect(db.audio_generation_events[0].status).toBe("failed");
  });

  it("renders the script and archives nothing when there is no draft", async () => {
    seed({ script: CURRENT, draft_script: null, audio_path: null, status: "processing_audio" });

    await processAudioWorkflow("med-1", null, "evt-1");

    expect(narratedText()).toContain(CURRENT);
    expect(meditation()).toMatchObject({
      script: CURRENT,
      status: "completed",
      audio_path: uploads[0],
    });
    expect(db.meditation_versions).toHaveLength(0);
  });

  it("marks a first render failed when it fails", async () => {
    seed({ script: CURRENT, draft_script: null, audio_path: null, status: "processing_audio" });
    mockWriteFiles.mockRejectedValue(new Error("sandbox down"));

    await expect(processAudioWorkflow("med-1", null, "evt-1")).rejects.toThrow();

    expect(meditation().status).toBe("failed");
  });

  it("uploads every render to a new path under <user_id>/<meditation_id>/", async () => {
    seed({ script: CURRENT, draft_script: null, audio_path: null, status: "processing_audio" });
    await processAudioWorkflow("med-1", null, "evt-1");
    const first = meditation().audio_path as string;

    meditation().draft_script = DRAFT;
    meditation().draft_status = "processing";
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
});
