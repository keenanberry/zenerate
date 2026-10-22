import { getMeditationVersions } from "@/lib/meditation/actions";
import { VersionSwitcher } from "@/components/version-switcher";

/**
 * The owner's archived versions of a meditation. Renders nothing when there
 * are none, and nothing for anyone else: meditation_versions is owner-only
 * under RLS, so a visitor's read comes back empty even on a public meditation.
 */
export async function MeditationVersions({
  meditationId,
  title,
}: {
  meditationId: string;
  title: string;
}) {
  const versions = await getMeditationVersions(meditationId);
  if (versions.length === 0) return null;

  return <VersionSwitcher meditationId={meditationId} title={title} versions={versions} />;
}
