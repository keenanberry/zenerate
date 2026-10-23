import type { MeditationWithMeta } from "@/lib/meditation/types";
import { TrackRow } from "@/components/track-row";

interface MeditationTrackListProps {
  meditations: MeditationWithMeta[];
  showIndex?: boolean;
  showFavorite?: boolean;
  showVisibility?: boolean;
  actions?: (meditation: MeditationWithMeta, index: number) => React.ReactNode;
}

/**
 * Meditations as a track list. No header row: each row's meta line names
 * what a table would have put in columns (task 48).
 */
export function MeditationTrackList({
  meditations,
  showIndex = true,
  showFavorite = true,
  showVisibility = false,
  actions,
}: MeditationTrackListProps) {
  return (
    <div className="w-full">
      {meditations.map((m, i) => (
        <TrackRow
          key={m.id}
          meditation={m}
          index={i + 1}
          showIndex={showIndex}
          showFavorite={showFavorite}
          showVisibility={showVisibility}
          actions={actions?.(m, i)}
        />
      ))}
    </div>
  );
}
