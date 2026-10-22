/** "1 meditation", "3 meditations". */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The free tier in one sentence, from the cap the audio quota enforces. The
 * number comes from the environment (`PER_USER_MONTHLY_AUDIO_LIMIT`), so the
 * page never states a cap the app does not apply. Scripts have no monthly cap
 * since the studio replaced the one-shot generator.
 */
export function freeTierSummary(caps: { audio: number }): string {
  return (
    `Each month an account can narrate ${countOf(caps.audio, "meditation")}. ` +
    "Writing and revising scripts doesn't count toward it."
  );
}

