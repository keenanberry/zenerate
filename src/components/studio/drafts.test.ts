import { describe, expect, it } from "vitest";
import type { StudioUIMessage } from "@/lib/chat/tools";
import {
  collectDrafts,
  describeChatError,
  latestDetails,
  minutesLabel,
  showsQuickReplies,
  trimPartialLine,
} from "./drafts";

const output = {
  meditationId: "m1",
  savedAs: "script" as const,
  segments: { speech: 1, pause: 0, silence: 0, sound: 0 },
  droppedMarkers: 0,
  malformedLines: [],
  unknownSounds: [],
  estimatedSeconds: 540,
  targetSeconds: 600,
  withinTarget: true,
  issues: [],
};

function assistant(parts: StudioUIMessage["parts"]): StudioUIMessage {
  return { id: "a", role: "assistant", parts };
}

describe("trimPartialLine", () => {
  it("holds back a marker cut mid-way", () => {
    expect(trimPartialLine("Breathe in.\n*[PAU")).toBe("Breathe in.");
    expect(trimPartialLine("*[SOUND: bell")).toBe("");
  });

  it("keeps speech and complete lines", () => {
    expect(trimPartialLine("Breathe in.\nAnd o")).toBe("Breathe in.\nAnd o");
    expect(trimPartialLine("*[PAUSE: 5 seconds]*\n")).toBe("*[PAUSE: 5 seconds]*\n");
  });
});

describe("collectDrafts", () => {
  it("numbers drafts in order, skipping a call that failed", () => {
    const drafts = collectDrafts([
      { id: "u", role: "user", parts: [{ type: "text", text: "calm" }] },
      assistant([
        {
          type: "tool-writeScript",
          toolCallId: "t1",
          state: "output-available",
          input: { durationMinutes: 10, script: "One." },
          output,
        },
        {
          type: "tool-writeScript",
          toolCallId: "t2",
          state: "output-error",
          input: { durationMinutes: 10, script: "Refused." },
          errorText: "busy",
        },
        {
          type: "tool-writeScript",
          toolCallId: "t3",
          state: "input-streaming",
          input: { durationMinutes: 12, script: "Two.\n*[SIL" },
        },
      ]),
    ]);

    expect(drafts.map((d) => [d.toolCallId, d.number])).toEqual([
      ["t1", 1],
      ["t3", 2],
    ]);
    expect(drafts[0]).toMatchObject({ saved: true, streaming: false, durationMinutes: 10 });
    expect(drafts[0].estimate).toEqual({ estimatedSeconds: 540, targetSeconds: 600, withinTarget: true });
    // A streaming draft is never saved, and its cut-off marker is held back.
    expect(drafts[1]).toMatchObject({ saved: false, streaming: true, script: "Two.", estimate: null });
  });

  it("copes with a part whose input has not arrived", () => {
    const [draft] = collectDrafts([
      assistant([{ type: "tool-writeScript", toolCallId: "t", state: "input-streaming", input: undefined }]),
    ]);
    expect(draft).toMatchObject({ script: "", durationMinutes: null, streaming: true });
  });
});

describe("latestDetails", () => {
  it("takes the newest setDetails that ran", () => {
    const details = (title: string) =>
      ({
        type: "tool-setDetails",
        toolCallId: title,
        state: "output-available",
        input: { title, description: "d", tags: ["sleep", "body-scan"], type: "guided", durationMinutes: 10 },
        output: { meditationId: "m1", title, tags: ["sleep", "body-scan"] },
      }) as StudioUIMessage["parts"][number];

    expect(latestDetails([assistant([details("First")]), assistant([details("Second")])])).toEqual({
      title: "Second",
      tags: ["sleep", "body-scan"],
    });
    expect(latestDetails([])).toBeNull();
  });
});

describe("minutesLabel", () => {
  it("rounds to the minute", () => {
    expect(minutesLabel(616)).toBe("10 min");
    expect(minutesLabel(10)).toBe("1 min");
    expect(minutesLabel(3900)).toBe("1 h 5 min");
    expect(minutesLabel(3600)).toBe("1 h");
  });
});

describe("describeChatError", () => {
  it("reads the route's JSON body and flags a 429", () => {
    const error = Object.assign(new Error(JSON.stringify({ error: "Take a breather." })), {
      statusCode: 429,
    });
    expect(describeChatError(error)).toEqual({ message: "Take a breather.", rateLimited: true });
  });

  it("keeps a stream error's own sentence", () => {
    expect(describeChatError(new Error("Try sending that again."))).toEqual({
      message: "Try sending that again.",
      rateLimited: false,
    });
  });
});

describe("showsQuickReplies", () => {
  const draft = {
    type: "tool-writeScript",
    toolCallId: "t1",
    state: "output-available",
    input: { durationMinutes: 10, script: "One." },
    output,
  } as const;
  const reply = { type: "text", text: "It runs about 9 minutes. Any changes?" } as const;
  const request: StudioUIMessage = { id: "u", role: "user", parts: [{ type: "text", text: "calm" }] };

  it("shows after a saved draft with no audio card", () => {
    expect(showsQuickReplies([request, assistant([draft, reply])], false)).toBe(true);
  });

  it("hides while the turn is still running", () => {
    expect(showsQuickReplies([request, assistant([draft, reply])], true)).toBe(false);
  });

  it("hides once the person sends anything", () => {
    expect(showsQuickReplies([request, assistant([draft, reply]), request], false)).toBe(false);
  });

  it("hides when the turn already offered the audio card", () => {
    const card = {
      type: "tool-offerAudio",
      toolCallId: "o1",
      state: "input-available",
      input: {},
    } as const;
    expect(showsQuickReplies([request, assistant([draft, reply, card])], false)).toBe(false);
  });

  it("hides when the latest reply wrote no draft, or the draft did not save", () => {
    expect(showsQuickReplies([request, assistant([reply])], false)).toBe(false);
    const refused = { ...draft, state: "output-error", output: undefined, errorText: "busy" } as const;
    expect(showsQuickReplies([request, assistant([refused, reply])], false)).toBe(false);
    const stopped = { type: "tool-writeScript", toolCallId: "t2", state: "input-streaming", input: undefined } as const;
    expect(showsQuickReplies([request, assistant([stopped])], false)).toBe(false);
  });

  it("only looks at the latest reply", () => {
    expect(showsQuickReplies([request, assistant([draft, reply]), assistant([reply])], false)).toBe(false);
    expect(showsQuickReplies([], false)).toBe(false);
  });
});
