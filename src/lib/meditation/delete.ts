import type { SupabaseClient } from "@supabase/supabase-js";
import { removeMeditationAudio } from "@/lib/audio/storage";

/**
 * Deleting a meditation, shared by DELETE /api/meditations/[id] and the
 * deleteMeditation server action. Not a "use server" module: it takes the
 * caller's RLS-bound client and the user that client belongs to, so RLS
 * (`delete_own` on meditations) holds even if this code were wrong.
 *
 * What goes with the row, by foreign key: archived versions, the draft,
 * plays, favorites and collection items cascade; the chat it was made in
 * stays, with meditation_id null, so the conversation can make it again; the
 * audio ledger stays too, with meditation_id null, because the monthly caps
 * count it (20261120010000). Storage does not cascade at all, so the audio
 * files are removed here once the row is gone.
 */

export type DeleteOutcome = { ok: true } | { ok: false; reason: "not_found" | "busy" };

/** Postgres refuses a malformed uuid with an error; every id here is one. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteOwnMeditation(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<DeleteOutcome> {
  if (!UUID.test(id)) return { ok: false, reason: "not_found" };

  // Someone else's public meditation is readable, so the user_id filter is
  // what makes it read as missing rather than as something to delete.
  const { data: row, error: readError } = await supabase
    .from("meditations")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(`reading meditation failed: ${readError.message}`);
  if (!row) return { ok: false, reason: "not_found" };

  // A render in flight would upload into the folder just emptied and then
  // fail on the missing row. Wait for it to finish instead.
  const { data: draft, error: draftError } = await supabase
    .from("meditation_drafts")
    .select("render_status")
    .eq("meditation_id", id)
    .maybeSingle();
  if (draftError) throw new Error(`reading draft failed: ${draftError.message}`);
  if (row.status === "processing_audio" || draft?.render_status === "processing") {
    return { ok: false, reason: "busy" };
  }

  // Read the archived versions first: the delete cascades their rows away.
  const { data: versions, error: versionsError } = await supabase
    .from("meditation_versions")
    .select("audio_path")
    .eq("meditation_id", id);
  if (versionsError) throw new Error(`reading versions failed: ${versionsError.message}`);

  // The status filter repeats the check above inside the delete itself, so a
  // render started between the two (the audio route flips the row to
  // processing_audio) keeps its meditation. A draft render flips another
  // table, which no single delete can test; that window is the reads above.
  const { data: deleted, error } = await supabase
    .from("meditations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .neq("status", "processing_audio")
    .select("audio_path");
  if (error) throw new Error(`deleting meditation failed: ${error.message}`);
  if (!deleted?.length) {
    // Gone meanwhile (another tab), or a render started: tell them apart, as
    // the dialog takes a 404 for "already deleted".
    const { data: still, error: recheckError } = await supabase
      .from("meditations")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (recheckError) throw new Error(`reading meditation failed: ${recheckError.message}`);
    return { ok: false, reason: still ? "busy" : "not_found" };
  }

  // Only once the row is really gone, and only the caller's own folder. The
  // extra paths catch audio from before the per-user layout.
  try {
    await removeMeditationAudio(userId, id, [
      deleted[0].audio_path as string | null,
      ...(versions ?? []).map((v) => v.audio_path as string | null),
    ]);
  } catch (err) {
    // The meditation is deleted either way. A file left behind sits in the
    // owner's folder, where account deletion still finds it.
    console.error(`Removing audio for deleted meditation ${id} failed:`, err);
  }
  return { ok: true };
}
