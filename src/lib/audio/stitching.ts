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

  /** The ids to send with the next speech request, oldest first. */
  previous(): string[] {
    return this.ids.slice(-MAX_PREVIOUS_REQUEST_IDS);
  }

  /** A response without a `request-id` header leaves the chain as it was. */
  record(requestId: string | null | undefined): void {
    if (requestId) this.ids.push(requestId);
  }
}

/**
 * Whether a failed call was refused because of the ids it carried: a 4xx whose
 * message or body names them. The API calls them `previous_history_item_ids`
 * in its errors and `previous_request_ids` in the request.
 */
export function isRejectedForRequestIds(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { statusCode, body, message } = err as {
    statusCode?: unknown;
    body?: unknown;
    message?: unknown;
  };
  if (typeof statusCode !== "number" || statusCode < 400 || statusCode >= 500) {
    return false;
  }
  let text = typeof message === "string" ? message : "";
  try {
    text += ` ${typeof body === "string" ? body : JSON.stringify(body)}`;
  } catch {
    // An unserializable body leaves only the message to go on.
  }
  return /previous_(request|history_item)_ids|previousRequestIds/.test(text);
}

export interface SpeechResponse<T> {
  result: T;
  requestId: string | null;
}

/**
 * Makes one speech call stitched to the chain and records its id. If the call
 * is refused because of the ids, it is made once more without them, so a
 * change on ElevenLabs' side costs continuity for that line rather than the
 * whole render.
 */
export async function stitchedSpeech<T>(
  chain: RequestChain,
  call: (previousRequestIds: string[]) => Promise<SpeechResponse<T>>,
  log: (message: string) => void = console.log,
): Promise<T> {
  const previous = chain.previous();
  let response: SpeechResponse<T>;
  try {
    response = await call(previous);
  } catch (err) {
    if (previous.length === 0 || !isRejectedForRequestIds(err)) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    log(`  → previous request ids refused (${reason}); retrying this line without them`);
    response = await call([]);
  }
  chain.record(response.requestId);
  return response.result;
}
