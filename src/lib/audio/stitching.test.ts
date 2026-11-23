import { describe, it, expect } from "vitest";
import {
  MAX_PREVIOUS_REQUEST_IDS,
  RequestChain,
  isRejectedForRequestIds,
  stitchedSpeech,
} from "./stitching";

type Segment = { type: "speech" | "pause" | "silence" | "sound" };

/** Walks segments the way processSegments does, recording what each speech call was sent. */
async function render(segments: Segment[]) {
  const chain = new RequestChain();
  const sent: string[][] = [];
  let n = 0;
  for (const segment of segments) {
    if (segment.type !== "speech") continue;
    await stitchedSpeech(chain, async (ids) => {
      sent.push(ids);
      n++;
      return { result: null, requestId: `r${n}` };
    });
  }
  return sent;
}

// The 400 the API returned on 2026-11-23 for four ids.
const tooManyIds = Object.assign(new Error("Status code: 400"), {
  statusCode: 400,
  body: {
    detail: {
      type: "validation_error",
      code: "invalid_parameters",
      message: "A maximum of 3 previous_history_item_ids can be sent but received 4 items.",
      status: "too_many_history_item_ids",
      param: "previous_history_item_ids",
    },
  },
});

describe("request stitching", () => {
  it("sends nothing with the first line, then up to the last three ids in order", async () => {
    const sent = await render([
      { type: "speech" },
      { type: "speech" },
      { type: "speech" },
      { type: "speech" },
      { type: "speech" },
    ]);
    expect(sent).toEqual([
      [],
      ["r1"],
      ["r1", "r2"],
      ["r1", "r2", "r3"],
      ["r2", "r3", "r4"],
    ]);
    expect(Math.max(...sent.map((ids) => ids.length))).toBe(MAX_PREVIOUS_REQUEST_IDS);
  });

  it("carries the chain across pauses, silences and sounds", async () => {
    const sent = await render([
      { type: "sound" },
      { type: "speech" },
      { type: "pause" },
      { type: "speech" },
      { type: "silence" },
      { type: "sound" },
      { type: "speech" },
      { type: "pause" },
      { type: "speech" },
    ]);
    expect(sent).toEqual([[], ["r1"], ["r1", "r2"], ["r1", "r2", "r3"]]);
  });

  it("retries a failed call with the same ids and records only the success", async () => {
    const chain = new RequestChain();
    chain.record("r1");
    chain.record("r2");
    const sent: string[][] = [];
    const flaky = async (ids: string[]) => {
      sent.push(ids);
      if (sent.length === 1) throw Object.assign(new Error("Status code: 500"), { statusCode: 500 });
      return { result: null, requestId: "r3" };
    };

    await expect(stitchedSpeech(chain, flaky)).rejects.toThrow("500");
    await stitchedSpeech(chain, flaky);

    expect(sent).toEqual([
      ["r1", "r2"],
      ["r1", "r2"],
    ]);
    expect(chain.previous()).toEqual(["r1", "r2", "r3"]);
  });

  it("retries once without ids when the ids are refused, then stops stitching", async () => {
    const chain = new RequestChain();
    chain.record("r1");
    const sent: string[][] = [];
    const logged: string[] = [];
    let n = 1;
    const refusesIds = async (ids: string[]) => {
      sent.push(ids);
      if (ids.length > 0) throw tooManyIds;
      n++;
      return { result: null, requestId: `r${n}` };
    };

    await stitchedSpeech(chain, refusesIds, (m) => logged.push(m));
    await stitchedSpeech(chain, refusesIds, (m) => logged.push(m));
    await stitchedSpeech(chain, refusesIds, (m) => logged.push(m));

    // One refused call in the whole render, not one per later line.
    expect(sent).toEqual([["r1"], [], [], []]);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/without them/);
    expect(chain.previous()).toEqual([]);
  });

  it("does not retry without ids when they were not the problem", async () => {
    const chain = new RequestChain();
    chain.record("r1");
    const sent: string[][] = [];
    const quota = Object.assign(new Error("Status code: 401"), {
      statusCode: 401,
      body: { detail: { status: "quota_exceeded" } },
    });

    await expect(
      stitchedSpeech(chain, async (ids) => {
        sent.push(ids);
        throw quota;
      }),
    ).rejects.toBe(quota);
    expect(sent).toEqual([["r1"]]);
  });

  it("does not retry the first line, which sends no ids", async () => {
    const sent: string[][] = [];
    await expect(
      stitchedSpeech(new RequestChain(), async (ids) => {
        sent.push(ids);
        throw tooManyIds;
      }),
    ).rejects.toBe(tooManyIds);
    expect(sent).toEqual([[]]);
  });

  it("skips a response without a request id", () => {
    const chain = new RequestChain();
    chain.record("r1");
    chain.record(null);
    chain.record(undefined);
    expect(chain.previous()).toEqual(["r1"]);
  });
});

describe("isRejectedForRequestIds", () => {
  it("recognizes the API's refusal of the ids", () => {
    expect(isRejectedForRequestIds(tooManyIds)).toBe(true);
    expect(
      isRejectedForRequestIds({
        statusCode: 422,
        body: { detail: [{ loc: ["body", "previous_request_ids"], msg: "invalid" }] },
      }),
    ).toBe(true);
  });

  it("ignores a 422 about another field that echoes the ids in its input", () => {
    const otherField = Object.assign(new Error('Status code: 422\nBody: {"previous_request_ids": ["r1"]}'), {
      statusCode: 422,
      body: {
        detail: [
          {
            loc: ["body", "voice_settings", "speed"],
            msg: "Input should be less than or equal to 1.2",
            input: { text: "Hello.", previous_request_ids: ["r1"] },
          },
        ],
      },
    });
    expect(isRejectedForRequestIds(otherField)).toBe(false);
  });

  it("does not retry without ids for a 422 about another field", async () => {
    const chain = new RequestChain();
    chain.record("r1");
    const sent: string[][] = [];
    const otherField = {
      statusCode: 422,
      body: { detail: [{ loc: ["body", "text"], msg: "too long", input: { previous_request_ids: ["r1"] } }] },
    };
    await expect(
      stitchedSpeech(chain, async (ids) => {
        sent.push(ids);
        throw otherField;
      }),
    ).rejects.toBe(otherField);
    expect(sent).toEqual([["r1"]]);
    expect(chain.previous()).toEqual(["r1"]);
  });

  it("ignores other failures", () => {
    expect(isRejectedForRequestIds(new Error("network down"))).toBe(false);
    expect(isRejectedForRequestIds({ statusCode: 400, body: { detail: { message: "text too long" } } })).toBe(false);
    expect(isRejectedForRequestIds({ statusCode: 500, body: "previous_request_ids" })).toBe(false);
    expect(isRejectedForRequestIds(null)).toBe(false);
    // The SDK's message carries the whole body; only the detail counts.
    expect(
      isRejectedForRequestIds({
        statusCode: 400,
        message: "Body: previous_request_ids",
        body: { detail: { param: "text", message: "text too long" } },
      }),
    ).toBe(false);
  });
});
