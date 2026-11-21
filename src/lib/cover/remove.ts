import { createClient as createServiceClient } from "@/lib/supabase/service-role";
import { COVER_BUCKET } from "./url";

/** A meditation id, which is the whole of a cover's folder name. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove every cover object a meditation has: the current one and any an
 * earlier generation left. Covers live at `<meditation_id>/<random>.<ext>`
 * in a bucket only the service role writes, so this lists the meditation's
 * folder and removes what is there. Storage does not cascade from the
 * database, so whatever deletes a meditation row calls this once the row is
 * gone. A folder that is already empty is not an error.
 */
export async function removeMeditationCovers(meditationId: string): Promise<void> {
  // Never list or remove anything but one meditation's own folder.
  if (!UUID.test(meditationId)) throw new Error(`Not a meditation id: "${meditationId}"`);

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(COVER_BUCKET).list(meditationId, { limit: 1000 });
  if (error) throw new Error(`Cover list failed: ${error.message}`);

  const paths = (data ?? []).map((object) => `${meditationId}/${object.name}`);
  if (paths.length === 0) return;
  const { error: removeError } = await supabase.storage.from(COVER_BUCKET).remove(paths);
  if (removeError) throw new Error(`Cover remove failed: ${removeError.message}`);
}
