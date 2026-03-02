import type { MeditationWithMeta } from "@/lib/meditation/types";
import { TrackRow } from "@/components/track-row";

interface MeditationTrackListProps {
  meditations: MeditationWithMeta[];
  showIndex?: boolean;
  showFavorite?: boolean;
  showVisibility?: boolean;
  actions?: (meditation: MeditationWithMeta, index: number) => React.ReactNode;
}

export function MeditationTrackList({
  meditations,
  showIndex = true,
  showFavorite = true,
  showVisibility = false,
  actions,
}: MeditationTrackListProps) {
  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex items-center gap-3 border-b px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {showIndex && <span className="w-8 text-center">#</span>}
        <span className="flex-1">Title</span>
        <span className="hidden w-28 sm:block">Type</span>
        <span className="hidden w-16 text-right md:block">Duration</span>
        <span className="hidden w-20 text-right sm:block">Date</span>
        {showFavorite && <span className="w-8" />}
        {actions && <span className="w-8" />}
      </div>

      {/* Track rows */}
      <div>
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
    </div>
  );
}
