import { describe, it, expect, beforeEach } from "vitest";
import type { ModelMessage } from "ai";
import { z } from "zod";
import {
  offerAudioInput,
  lengthToleranceSeconds,
  MAX_STEPS_PER_TURN,
  prepareStudioStep,
  studioTools,
  previewSoundsInput,
  setDetailsInput,
  writeScriptInput,
  type StudioToolContext,
} from "./tools";

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "update" | "upsert"; values: Row };

/**
 * Just enough of the Supabase query builder for the tools: select().eq().single()
 * or .maybeSingle(), insert().select().single(), update().eq() and upsert().
 * Writes are recorded, not applied.
 */
function fakeSupabase(tables: { chats: Row; meditations?: Row; meditation_drafts?: Row }) {
  const writes: Write[] = [];
  const from = (table: string) => {
    const row = () => tables[table as keyof typeof tables];
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: row() ?? null, error: row() ? null : { message: "none" } }),
      maybeSingle: async () => ({ data: row() ?? null, error: null }),
      upsert: async (values: Row) => {
        writes.push({ table, op: "upsert", values });
        return { error: null };
      },
      insert: (values: Row) => {
        writes.push({ table, op: "insert", values });
        return {
          select: () => ({ single: async () => ({ data: { id: "med-new" }, error: null }) }),
        };
      },
      update: (values: Row) => {
        writes.push({ table, op: "update", values });
        return { eq: async () => ({ error: null }) };
      },
    };
    return chain;
  };
  return { client: { from } as unknown as StudioToolContext["supabase"], writes };
}

function context(supabase: StudioToolContext["supabase"]): StudioToolContext {
  return { supabase, userId: "user-1", chatId: "chat-1" };
}

async function run<T>(
  name: "writeScript" | "setDetails",
  input: T,
  ctx: StudioToolContext,
  messages: ModelMessage[] = [],
) {
  const execute = studioTools[name].execute as unknown as (
    input: T,
    options: { toolCallId: string; messages: ModelMessage[]; context: StudioToolContext },
  ) => Promise<Record<string, unknown>>;
  return execute(input, { toolCallId: "call-1", messages, context: ctx });
}

/** A turn so far: the user's message, then each earlier writeScript and its result. */
function turn(...results: Record<string, unknown>[]): ModelMessage[] {
  return [
    { role: "user", content: "Make it 20 minutes" },
    ...results.flatMap((value, i): ModelMessage[] => [
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: `w${i}`, toolName: "writeScript", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: `w${i}`,
            toolName: "writeScript",
            output: { type: "json", value: value as never },
          },
        ],
      },
    ]),
  ];
}

// 10 minutes: ~30 words of speech, 30s of pauses, 9 min of silence, two 7s bells.
const GOOD_SCRIPT = [
  "*[SOUND: bell-tibetan.mp3]*",
  "Welcome. Let the day fall away from your shoulders as you settle in and breathe slowly, softly, and without hurry.",
  "*[PAUSE: 15 seconds]*",
  "*[SILENCE: 9 minutes]*",
  "*[PAUSE: 15 seconds]*",
  "Gently return, and open your eyes when you are ready.",
  "*[SOUND: bell-tibetan.mp3]*",
].join("\n\n");

describe("writeScript", () => {
  let db: ReturnType<typeof fakeSupabase>;

  beforeEach(() => {
    db = fakeSupabase({ chats: { meditation_id: null } });
  });

  it("creates the meditation on the first call and links the chat", async () => {
    const result = await run("writeScript", { durationMinutes: 10, script: GOOD_SCRIPT }, context(db.client));

    expect(db.writes[0]).toMatchObject({
      table: "meditations",
      op: "insert",
      values: {
        user_id: "user-1",
        script: GOOD_SCRIPT,
        status: "script_ready",
        is_public: false,
      },
    });
    // The request stays in the owner-only chat, never on the meditation row.
    expect(db.writes[0].values).not.toHaveProperty("prompt");
    expect(db.writes[1]).toMatchObject({ table: "chats", op: "update", values: { meditation_id: "med-new" } });
    expect(result).toMatchObject({
      meditationId: "med-new",
      savedAs: "script",
      droppedMarkers: 0,
      targetSeconds: 600,
      segments: { speech: 2, pause: 2, silence: 1, sound: 2 },
      withinTarget: true,
    });
  });

  it("overwrites script while there is no audio yet", async () => {
    db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: null, status: "script_ready", settings: { type: "guided", duration: 10 } },
    });
    const result = await run("writeScript", { durationMinutes: 10, script: GOOD_SCRIPT }, context(db.client));

    expect(result.savedAs).toBe("script");
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].values).toMatchObject({
      script: GOOD_SCRIPT,
      settings: { type: "guided", duration: 10 },
    });
    expect(db.writes[0].table).toBe("meditations");
  });

  it("writes a revision to the owner-only drafts table once there is audio, leaving the meditation alone", async () => {
    db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: "user-1/med-1.mp3", status: "completed", settings: { duration: 10 } },
    });
    const result = await run("writeScript", { durationMinutes: 10, script: GOOD_SCRIPT }, context(db.client));

    expect(result.savedAs).toBe("draft_script");
    // One write, and not to meditations: anon can read that row.
    expect(db.writes).toEqual([
      {
        table: "meditation_drafts",
        op: "upsert",
        values: { meditation_id: "med-1", script: GOOD_SCRIPT, updated_at: expect.any(String) },
      },
    ]);
  });

  it("refuses while audio is rendering", async () => {
    db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: null, status: "processing_audio", settings: {} },
    });
    await expect(
      run("writeScript", { durationMinutes: 10, script: GOOD_SCRIPT }, context(db.client)),
    ).rejects.toThrow(/Audio is being made/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses while a revision is rendering, though the meditation stays completed", async () => {
    db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: "u/med-1/a.mp3", status: "completed", settings: {} },
      meditation_drafts: { script: "The revision being rendered.", render_status: "processing" },
    });
    await expect(
      run("writeScript", { durationMinutes: 10, script: GOOD_SCRIPT }, context(db.client)),
    ).rejects.toThrow(/Audio is being made/);
    expect(db.writes).toHaveLength(0);
  });

  it("reports malformed markers", async () => {
    const script = GOOD_SCRIPT.replace("*[PAUSE: 15 seconds]*", "*[PAUSE: fifteen seconds]*");
    const result = await run("writeScript", { durationMinutes: 10, script }, context(db.client));

    expect(result.droppedMarkers).toBeGreaterThan(0);
    expect(result.malformedLines).toEqual(["*[PAUSE: fifteen seconds]*"]);
    expect(result.issues).toEqual(expect.arrayContaining([expect.stringMatching(/malformed/)]));
  });

  it("flags a script well short of its target", async () => {
    const result = await run("writeScript", { durationMinutes: 20, script: GOOD_SCRIPT }, context(db.client));
    expect(result.withinTarget).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.stringMatching(/short of/)]));
  });

  it("accepts 2 minutes or 15% either side of the target, whichever is larger", () => {
    expect(lengthToleranceSeconds(5 * 60)).toBe(120);
    expect(lengthToleranceSeconds(10 * 60)).toBe(120);
    expect(lengthToleranceSeconds(20 * 60)).toBe(180);
    expect(lengthToleranceSeconds(60 * 60)).toBe(540);
  });

  it("accepts a draft a little off the target as is", async () => {
    // GOOD_SCRIPT runs about 10 min: 2 min long for an 8 min target.
    const result = await run("writeScript", { durationMinutes: 8, script: GOOD_SCRIPT }, context(db.client));
    expect(result.withinTarget).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("asks for one length rewrite per turn, then accepts the next draft as written", async () => {
    const first = await run("writeScript", { durationMinutes: 20, script: GOOD_SCRIPT }, context(db.client));
    expect(first.withinTarget).toBe(false);

    const second = await run(
      "writeScript",
      { durationMinutes: 20, script: GOOD_SCRIPT },
      context(db.client),
      turn(first),
    );
    expect(second.withinTarget).toBe(true);
    expect(second.issues).toEqual([]);
    expect(second.note).toMatch(/^Accepted at 10 min/);

    const third = await run(
      "writeScript",
      { durationMinutes: 20, script: GOOD_SCRIPT },
      context(db.client),
      turn(first, second),
    );
    expect(third.issues).toEqual([]);
  });

  it("starts the count again with each new message", async () => {
    const earlier = await run("writeScript", { durationMinutes: 20, script: GOOD_SCRIPT }, context(db.client));
    const messages: ModelMessage[] = [...turn(earlier), { role: "user", content: "Try again" }];
    const result = await run("writeScript", { durationMinutes: 20, script: GOOD_SCRIPT }, context(db.client), messages);
    expect(result.withinTarget).toBe(false);
  });

  it("still reports malformed markers after the length rewrite", async () => {
    const first = await run("writeScript", { durationMinutes: 20, script: GOOD_SCRIPT }, context(db.client));
    const script = GOOD_SCRIPT.replace("*[PAUSE: 15 seconds]*", "*[PAUSE: fifteen seconds]*");
    const result = await run("writeScript", { durationMinutes: 20, script }, context(db.client), turn(first));
    expect(result.issues).toEqual([expect.stringMatching(/malformed/)]);
  });

  it("flags sounds outside the catalog", async () => {
    const script = GOOD_SCRIPT.replace("bell-tibetan.mp3", "rain.mp3");
    const result = await run("writeScript", { durationMinutes: 10, script }, context(db.client));
    expect(result.unknownSounds).toEqual(["rain.mp3"]);
  });

  it("requires a target length and a non-empty script", () => {
    expect(writeScriptInput.safeParse({ script: GOOD_SCRIPT }).success).toBe(false);
    expect(writeScriptInput.safeParse({ durationMinutes: 10, script: "" }).success).toBe(false);
  });
});

describe("setDetails", () => {
  const details = {
    title: "Unwind",
    description: "Ten quiet minutes to let a hard day go.",
    tags: ["stress-relief", "rough-day"],
    type: "guided",
    durationMinutes: 10,
  };

  it("rejects a tag outside the vocabulary", () => {
    const result = setDetailsInput.safeParse({ ...details, tags: ["stress-relief", "python"] });
    expect(result.success).toBe(false);
  });

  it("takes 2 to 5 tags", () => {
    expect(setDetailsInput.safeParse({ ...details, tags: ["sleep"] }).success).toBe(false);
    expect(
      setDetailsInput.safeParse({
        ...details,
        tags: ["sleep", "bedtime", "breathwork", "body-scan", "grounding", "mantra"],
      }).success,
    ).toBe(false);
    expect(setDetailsInput.safeParse(details).success).toBe(true);
  });

  it("splits tags sent as one comma-separated string", () => {
    const result = setDetailsInput.safeParse({
      ...details,
      tags: "breathwork, inner-peace,breathwork,",
    });
    expect(result.success && result.data.tags).toEqual(["breathwork", "inner-peace"]);
    expect(setDetailsInput.safeParse({ ...details, tags: "breathwork,python" }).success).toBe(false);
    expect(setDetailsInput.safeParse({ ...details, tags: "breathwork" }).success).toBe(false);
  });

  it("still advertises tags as an array of the vocabulary", () => {
    const schema = z.toJSONSchema(setDetailsInput, { io: "input" }) as {
      properties: { tags: { type: string; items: { enum: string[] } } };
    };
    expect(schema.properties.tags.type).toBe("array");
    expect(schema.properties.tags.items.enum).toContain("breathwork");
  });

  it("is the schema the tool exposes", () => {
    expect(studioTools.setDetails.inputSchema).toBe(setDetailsInput);
  });

  it("writes title, description, tags and settings, and names the chat", async () => {
    const db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: null, settings: { duration: 10, voice: "v1" } },
    });
    await run("setDetails", details, context(db.client));

    expect(db.writes[0]).toMatchObject({
      table: "meditations",
      values: {
        title: "Unwind",
        description: details.description,
        tags: ["stress-relief", "rough-day"],
        settings: { type: "guided", duration: 10, voice: "v1" },
      },
    });
    expect(db.writes[1]).toMatchObject({ table: "chats", values: { title: "Unwind" } });
  });

  it("leaves settings alone once audio exists", async () => {
    const db = fakeSupabase({
      chats: { meditation_id: "med-1" },
      meditations: { audio_path: "user-1/med-1.mp3", settings: { duration: 10 } },
    });
    await run("setDetails", { ...details, durationMinutes: 20 }, context(db.client));
    expect(db.writes[0].values).not.toHaveProperty("settings");
  });

  it("asks for a script first when the chat has none", async () => {
    const db = fakeSupabase({ chats: { meditation_id: null } });
    await expect(run("setDetails", details, context(db.client))).rejects.toThrow(/writeScript first/);
  });
});

describe("offerAudio", () => {
  it("is client-side: it has no execute", () => {
    expect(studioTools.offerAudio.execute).toBeUndefined();
  });

  it("takes an optional ambient bed to preselect, never None or an unknown one", () => {
    expect(offerAudioInput.safeParse({}).success).toBe(true);
    expect(offerAudioInput.safeParse({ ambience: "rain" }).success).toBe(true);
    expect(offerAudioInput.safeParse({ ambience: "none" }).success).toBe(false);
    expect(offerAudioInput.safeParse({ ambience: "whale-song" }).success).toBe(false);
  });
});

describe("previewSounds", () => {
  const execute = studioTools.previewSounds.execute as unknown as (
    input: { sounds: string[] },
    options: { toolCallId: string; messages: [] },
  ) => Promise<{ sounds: { name: string; label: string; url: string; seconds: number }[] }>;

  it("returns each sound's label, URL and length, once each", async () => {
    const result = await execute(
      { sounds: ["bell-tibetan.mp3", "gong-deep.mp3", "bell-tibetan.mp3"] },
      { toolCallId: "call-1", messages: [] },
    );
    expect(result.sounds).toEqual([
      { name: "bell-tibetan.mp3", label: "Tibetan bell", url: "/sounds/bell-tibetan.mp3", seconds: 7 },
      { name: "gong-deep.mp3", label: "Deep gong", url: "/sounds/gong-deep.mp3", seconds: 12 },
    ]);
  });

  it("accepts only catalog sounds, and at least one", () => {
    expect(previewSoundsInput.safeParse({ sounds: ["rain.mp3"] }).success).toBe(false);
    expect(previewSoundsInput.safeParse({ sounds: [] }).success).toBe(false);
    expect(previewSoundsInput.safeParse({ sounds: ["chime-soft.mp3"] }).success).toBe(true);
  });
});

describe("prepareStudioStep", () => {
  const draftTurn: ModelMessage[] = [{ role: "user", content: "10 minutes to unwind" }];

  it("leaves every tool open on the turn's early steps", () => {
    expect(prepareStudioStep({ stepNumber: 0, messages: draftTurn })).toBeUndefined();
    expect(prepareStudioStep({ stepNumber: MAX_STEPS_PER_TURN - 2, messages: draftTurn })).toBeUndefined();
  });

  it("keeps the last step for the closing line", () => {
    expect(prepareStudioStep({ stepNumber: MAX_STEPS_PER_TURN - 1, messages: draftTurn })).toEqual({
      toolChoice: "none",
    });
  });

  it("lets the first step after \"Make the audio\" only offer the audio card", () => {
    const asString: ModelMessage[] = [{ role: "user", content: "Make the audio" }];
    const asParts: ModelMessage[] = [{ role: "user", content: [{ type: "text", text: "Make the audio" }] }];
    for (const messages of [asString, asParts]) {
      expect(prepareStudioStep({ stepNumber: 0, messages })).toEqual({ activeTools: ["offerAudio"] });
    }
  });

  it("frees the tools again once the card is answered, and for any other message", () => {
    // The continuation after the card ends on its tool result, not the request.
    const continued: ModelMessage[] = [
      { role: "user", content: "Make the audio" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "o1", toolName: "offerAudio", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "o1",
            toolName: "offerAudio",
            output: { type: "json", value: { outcome: "started" } },
          },
        ],
      },
    ];
    expect(prepareStudioStep({ stepNumber: 0, messages: continued })).toBeUndefined();
    const other: ModelMessage[] = [{ role: "user", content: "Make the audio, but softer first" }];
    expect(prepareStudioStep({ stepNumber: 0, messages: other })).toBeUndefined();
  });
});
