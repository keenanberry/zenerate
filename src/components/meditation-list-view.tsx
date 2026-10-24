"use client";

import { MeditationCard } from "@/components/meditation-card";
import { MeditationTrackList } from "@/components/meditation-track-list";
import { useView } from "@/components/view-context";
import type { MeditationWithMeta } from "@/lib/meditation/types";

interface MeditationListViewProps {
  meditations: MeditationWithMeta[];
  showFavorite?: boolean;
  showVisibility?: boolean;
}

export function MeditationListView({
  meditations,
  showFavorite = true,
  showVisibility = false,
}: MeditationListViewProps) {
  const { view } = useView();

  if (view === "grid") {
    return (
      // The collection grid's columns and rhythm, so the two tabs match.
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {meditations.map((m) => (
          <MeditationCard
            key={m.id}
            meditation={m}
            showFavorite={showFavorite}
            showVisibility={showVisibility}
          />
        ))}
      </div>
    );
  }

  return (
    <MeditationTrackList
      meditations={meditations}
      showFavorite={showFavorite}
      showVisibility={showVisibility}
    />
  );
}
