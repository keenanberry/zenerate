/**
 * The sentence the generate panel shows for a failed POST /api/audio/generate.
 *
 * The route writes a specific sentence for every failure it understands (an
 * unknown voice, a status conflict, a start that failed and was refunded, the
 * global cap), so that sentence wins whenever it is there. The status code
 * only decides the fallback when the body carries nothing.
 */
export function generateErrorMessage(status: number, body: { error?: unknown; [key: string]: unknown }): string {
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (status === 429) return "Monthly limit reached";
  if (status === 503) return "Audio generation is temporarily unavailable. Try again shortly.";
  return "Failed to start audio generation";
}
