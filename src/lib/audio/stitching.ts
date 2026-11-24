/**
 * Request stitching for narration (task: voice continuity across pauses).
 *
 * Every speech segment is its own ElevenLabs request, so without context the
 * narrator's tone resets after each PAUSE and sounds like a new speaker.
 * Passing the request ids of the speech just rendered as
 * `previous_request_ids` lets the model carry the voice on. The operator chose
 * this over `previous_text`/`next_text` by ear on 2026-11-23: neighbouring text
 * slowed the delivery and `next_text` added trailing silence on top of the
 * script's pauses. The API ignores `previous_text` when ids are sent anyway.
 *
 * Kept free of ffmpeg, the SDK and the network so it can be unit-tested; it is
 * bundled into the sandbox snapshot with generate-audio.ts.
 */

/** The API refuses a fourth id (HTTP 400, `too_many_history_item_ids`). */
export const MAX_PREVIOUS_REQUEST_IDS = 3;

/**
 * The speech requests made so far in one render, in order. Pauses, silences
 * and sounds never touch it, so the chain runs across them; a call that
 * fails records nothing, so its retry is sent with the same ids.
 */
export class RequestChain {
  private readonly ids: string[] = [];
  private disabled = false;

  /** The ids to send with the next speech request, oldest first. */
  previous(): string[] {
    return this.disabled ? [] : this.ids.slice(-MAX_PREVIOUS_REQUEST_IDS);
  }

  /**
   * Stops stitching for the rest of the render. A refusal is most likely
   * account- or API-wide, and every later line would otherwise be sent twice.
   */
  disable(): void {
    this.disabled = true;
  }

  /** A response without a `request-id` header leaves the chain as it was. */
  record(requestId: string | null | undefined): void {
    if (requestId) this.ids.push(requestId);
  }
}

const REQUEST_IDS_FIELD = /previous_(request|history_item)_ids/;

/**
 * Whether a failed call was refused because of the ids it carried: a 4xx whose
 * error detail names them. The API calls them `previous_history_item_ids` in
 * its errors and `previous_request_ids` in the request.
 *
 * Only the detail's `param`, `status` and `message` (a 400) or each entry's
 * `loc` (a 422) are read. The error's own message is not: the SDK writes the
 * whole body into it, and a 422 about another field can echo the request,
 * ids and all, in its `input`.
 */
export function isRejectedForRequestIds(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { statusCode, body } = err as { statusCode?: unknown; body?: unknown };
  if (typeof statusCode !== "number" || statusCode < 400 || statusCode >= 500) {
    return false;
  }
  const detail = (body as { detail?: unknown } | null | undefined)?.detail;
  const names: unknown[] = [];
  if (typeof detail === "string") {
    names.push(detail);
  } else if (Array.isArray(detail)) {
    for (const entry of detail) {
      const loc = (entry as { loc?: unknown } | null)?.loc;
      if (Array.isArray(loc)) names.push(...loc);
    }
  } else if (typeof detail === "object" && detail !== null) {
    const { param, status, message } = detail as Record<string, unknown>;
    names.push(param, status, message);
  }
  return names.some((name) => typeof name === "string" && REQUEST_IDS_FIELD.test(name));
}

export interface SpeechResponse<T> {
  result: T;
  requestId: string | null;
}

export interface StitchedSpeechOptions<T> {
  log?: (message: string) => void;
  /**
   * Checks what a call produced (generate-audio.ts: that the clip is not
   * near-silent). A clip it rejects is requested once more with the same
   * ids; rejected twice, the line fails.
   */
  accept?: (result: T) => Promise<boolean>;
  /** Names the line in a failure, for the render's log and Sentry. */
  label?: string;
}

/**
 * Makes one speech call stitched to the chain and records the id of the
 * response it keeps.
 *
 * - Refused because of the ids: made once more without them, and the chain is
 *   disabled, so a change on ElevenLabs' side costs continuity for the rest of
 *   the render rather than the render itself, and later lines are not each
 *   sent twice.
 * - Rejected by `accept`: made once more with the same ids. A second rejection
 *   throws rather than let the render ship it.
 */
export async function stitchedSpeech<T>(
  chain: RequestChain,
  call: (previousRequestIds: string[]) => Promise<SpeechResponse<T>>,
  { log = console.log, accept, label = "a line" }: StitchedSpeechOptions<T> = {},
): Promise<T> {
  let ids = chain.previous();
  let response: SpeechResponse<T>;
  try {
    response = await call(ids);
  } catch (err) {
    if (ids.length === 0 || !isRejectedForRequestIds(err)) throw err;
    chain.disable();
    const reason = err instanceof Error ? err.message : String(err);
    log(
      `  → previous request ids refused (${reason}); retrying this line without them ` +
        "and no longer stitching this render",
    );
    ids = [];
    response = await call(ids);
  }
  if (accept && !(await accept(response.result))) {
    log("  → came back near-silent; requesting it once more");
    response = await call(ids);
    if (!(await accept(response.result))) {
      throw new Error(
        `Speech for ${label} came back near-silent twice; failing the render rather than shipping silence`,
      );
    }
  }
  chain.record(response.requestId);
  return response.result;
}
