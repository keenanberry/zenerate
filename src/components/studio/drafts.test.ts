import { describe, expect, it } from "vitest";
import type { StudioUIMessage } from "@/lib/chat/tools";
import {
  collectDrafts,
  currentCover,
  currentMeditationId,
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

describe("currentMeditationId", () => {
  const wrote = (meditationId: string) =>
    assistant([
      {
        type: "tool-writeScript",
        toolCallId: `t-${meditationId}`,
        state: "output-available",
        input: { durationMinutes: 10, script: "One." },
        output: { ...output, meditationId },
      },
    ]);

  it("follows the latest script, else the chat's meditation", () => {
    expect(currentMeditationId([], [], null)).toBeNull();
    expect(currentMeditationId([], [], "m1")).toBe("m1");
    expect(currentMeditationId([wrote("m1")], [], null)).toBe("m1");
    expect(currentMeditationId([wrote("m1")], [wrote("m1")], "m1")).toBe("m1");
  });

  it("ignores a meditation deleted since the chat made it, until a script makes another", () => {
    const history = [wrote("gone")];
    expect(currentMeditationId(history, history, null)).toBeNull();
    expect(currentMeditationId([...history, wrote("m2")], history, null)).toBe("m2");
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

describe("currentCover", () => {
  const subject = { subject: "A still lake at dawn.", style: "photograph" as const };
  const made = (id: string, url: string): StudioUIMessage["parts"][number] => ({
    type: "tool-makeCover",
    toolCallId: id,
    state: "output-available",
    input: subject,
    output: { coverUrl: url, remaining: 2 },
  });

  const request = (text: string): StudioUIMessage => ({
    id: "u",
    role: "user",
    parts: [{ type: "text", text }],
  });
  const wrote: StudioUIMessage["parts"][number] = {
    type: "tool-writeScript",
    toolCallId: "w1",
    state: "output-available",
    input: { script: "Breathe in.", durationMinutes: 10 },
    output,
  };
  const failed: StudioUIMessage["parts"][number] = {
    type: "tool-makeCover",
    toolCallId: "c9",
    state: "output-error",
    input: subject,
    errorText: "The cover could not be made this time.",
  };

  it("is the loaded photo when this session made none", () => {
    expect(currentCover([], [], "https://x/loaded.webp", null, false)).toEqual({
      url: "https://x/loaded.webp",
      status: "photo",
      making: false,
    });
  });

  it("falls back when the meditation loaded without a cover and nothing runs", () => {
    expect(currentCover([], [], null, null, false)).toEqual({ url: null, status: "fallback", making: false });
    // A live turn that only talks expects no cover either.
    const talk = [request("hi"), assistant([{ type: "text", text: "Hello." }])];
    expect(currentCover(talk, [], null, null, true).status).toBe("fallback");
  });

  it("trusts the loaded cover over the history it was loaded with", () => {
    // The row is the truth on load: a backfill may have set a newer cover,
    // or the meditation may be gone (null) and its history covers with it.
    const history = [assistant([made("c1", "https://x/old.webp")])];
    expect(currentCover(history, history, "https://x/row.webp", null, false).url).toBe("https://x/row.webp");
    expect(currentCover(history, history, null, null, false)).toEqual({ url: null, status: "fallback", making: false });
  });

  it("takes the newest cover made in this session", () => {
    const history = [assistant([made("c1", "https://x/old.webp")])];
    const messages = [
      ...history,
      request("a forest instead"),
      { ...assistant([made("c2", "https://x/a.webp"), made("c3", "https://x/b.webp")]), id: "a2" },
    ];
    expect(currentCover(messages, history, "https://x/old.webp", null, true)).toEqual({
      url: "https://x/b.webp",
      status: "photo",
      making: false,
    });
  });

  it("is expected while makeCover runs with no photo yet", () => {
    const streaming = [
      assistant([{ type: "tool-makeCover", toolCallId: "c1", state: "input-streaming", input: undefined }]),
    ];
    expect(currentCover(streaming, [], null, null, true)).toEqual({ url: null, status: "expected", making: true });
  });

  it("keeps the photo it has while a new one is made", () => {
    const messages = [
      assistant([
        made("c1", "https://x/a.webp"),
        { type: "tool-makeCover", toolCallId: "c2", state: "input-available", input: subject },
      ]),
    ];
    expect(currentCover(messages, [], null, null, true)).toEqual({ url: "https://x/a.webp", status: "photo", making: true });
    // A turn that ended leaves the call without a result: nothing is running.
    expect(currentCover(messages, [], null, null, false).making).toBe(false);
  });

  it("is expected in the live turn that wrote the script, before makeCover is called", () => {
    const messages = [request("a sleep meditation"), assistant([wrote])];
    expect(currentCover(messages, [], null, null, true)).toEqual({ url: null, status: "expected", making: false });
    // From the first streamed line, so the chip never flashes the designed cover first.
    const streaming = [request("a sleep meditation"), assistant([{ ...wrote, state: "input-streaming" } as never])];
    expect(currentCover(streaming, [], null, null, true).status).toBe("expected");
  });

  it("falls back once the turn ends without a cover", () => {
    const messages = [request("a sleep meditation"), assistant([wrote, { type: "text", text: "Here it is." }])];
    expect(currentCover(messages, [], null, null, false)).toEqual({ url: null, status: "fallback", making: false });
  });

  it("falls back once makeCover has failed, even while the turn runs", () => {
    const messages = [request("a sleep meditation"), assistant([wrote, failed])];
    expect(currentCover(messages, [], null, null, true)).toEqual({ url: null, status: "fallback", making: false });
    expect(currentCover([assistant([failed])], [], "https://x/row.webp", null, false)).toEqual({
      url: "https://x/row.webp",
      status: "photo",
      making: false,
    });
  });

  it("expects a cover in a revision whose saved script carries the server's cover request", () => {
    const messages = [
      request("a sleep meditation"),
      assistant([wrote, failed]),
      request("make it shorter"),
      { ...assistant([{ ...wrote, toolCallId: "w2", output: { ...output, cover: "This meditation has no cover yet." } }]), id: "a2" },
    ];
    expect(currentCover(messages, [], null, null, true).status).toBe("expected");
  });

  it("falls back in a revision whose saved script asks for no cover", () => {
    // A pre-cover meditation with audio, or one whose covers failed twice:
    // the server leaves `cover` off and the agent makes none.
    const messages = [request("make it shorter"), assistant([{ ...wrote, toolCallId: "w2" }])];
    expect(currentCover(messages, [], null, "m1", true)).toEqual({ url: null, status: "fallback", making: false });
    // The same, when the meditation was made earlier in this session.
    const session = [
      request("a sleep meditation"),
      assistant([wrote, failed]),
      request("make it shorter"),
      { ...assistant([{ ...wrote, toolCallId: "w2" }]), id: "a2" },
    ];
    expect(currentCover(session, [], null, null, true).status).toBe("fallback");
  });

  it("falls back in a turn that only renames", () => {
    const renamed: StudioUIMessage["parts"][number] = {
      type: "tool-setDetails",
      toolCallId: "d1",
      state: "output-available",
      input: { title: "Night Tide", description: "A calm wind-down.", tags: ["sleep"], type: "guided", durationMinutes: 10 },
      output: { title: "Night Tide", tags: ["sleep"] },
    } as never;
    const messages = [request("call it Night Tide"), assistant([renamed])];
    expect(currentCover(messages, [], null, "m1", true)).toEqual({ url: null, status: "fallback", making: false });
  });

  it("expects a cover for a new script in a chat whose meditation was deleted", () => {
    // The history's scripts made a meditation that is gone; the next one makes a new one.
    const history = [request("a sleep meditation"), assistant([wrote])];
    const messages = [...history, request("start again"), { ...assistant([{ ...wrote, toolCallId: "w2" }]), id: "a2" }];
    expect(currentCover(messages, history, null, null, true).status).toBe("expected");
  });
});
