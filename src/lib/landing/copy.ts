import { parseMeditationText } from "@/lib/meditation/parser";

/** "1 meditation", "3 meditations". */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The free tier in one sentence, from the caps the quota code enforces. The
 * numbers come from the environment (`PER_USER_MONTHLY_AUDIO_LIMIT`,
 * `PER_USER_MONTHLY_SCRIPT_LIMIT`), so the page never states a cap the app
 * does not apply.
 */
export function freeTierSummary(caps: { audio: number; script: number }): string {
  return (
    `Each month an account can narrate ${countOf(caps.audio, "meditation")} ` +
    `and draft up to ${countOf(caps.script, "script")}.`
  );
}

/** The first spoken passage of a script, for a preview; null if it has none. */
export function firstPassage(script: string | null): string | null {
  if (!script) return null;
  const speech = parseMeditationText(script).find((s) => s.type === "speech");
  return speech?.type === "speech" ? speech.content : null;
}
