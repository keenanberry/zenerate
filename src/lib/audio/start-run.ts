/**
 * Start the audio workflow run, and if the start itself fails, put the
 * meditation back the way it was.
 *
 * The trigger route flips the meditation to processing_audio and reserves a
 * generation before it starts the run, so a start that throws (the workflow
 * backend refusing, a network fault, a missing credential) would otherwise
 * leave the row "generating audio" forever with no run behind it: the
 * workflow's own markFailed never runs because there is no workflow. The
 * revert is best effort; the start error is what gets reported either way.
 */
export type StartRunResult =
  | { ok: true; runId: string }
  | { ok: false; error: unknown };

export async function startRunOrRevert(opts: {
  start: () => Promise<{ runId: string }>;
  revert: () => Promise<void>;
}): Promise<StartRunResult> {
  try {
    const { runId } = await opts.start();
    return { ok: true, runId };
  } catch (error) {
    await opts.revert().catch((revertError) => {
      console.error("Reverting the meditation after a failed start also failed:", revertError);
    });
    return { ok: false, error };
  }
}
