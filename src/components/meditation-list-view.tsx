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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
