"use client";

import { useState } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { TrackPlayButton } from "@/components/track-play-button";
import { Badge } from "@/components/ui/badge";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  guided: "Guided",
  "body-scan": "Body Scan",
  breathwork: "Breathwork",
  "loving-kindness": "Loving Kindness",
  visualization: "Visualization",
  mindfulness: "Mindfulness",
  sleep: "Sleep",
  manifestation: "Manifestation",
  mantra: "Mantra",
};

function formatDuration(minutes?: number) {
  if (!minutes) return null;
  return `${minutes} min`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TrackRowProps {
  meditation: MeditationWithMeta;
  index: number;
  showIndex: boolean;
  showFavorite: boolean;
  showVisibility: boolean;
  actions?: React.ReactNode;
}

export function TrackRow({
  meditation: m,
  index,
  showIndex,
  showFavorite,
  showVisibility,
  actions,
}: TrackRowProps) {
  const [playing, setPlaying] = useState(false);

  const settings = m.settings ?? {};
  const type = typeLabels[settings.type ?? ""] ?? settings.type;
  const duration = formatDuration(settings.duration);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-3.5 hover:bg-muted/50 motion-safe:transition-colors",
        playing && "bg-primary/5",
      )}
    >
      {showIndex && (
        <TrackPlayButton
          index={index}
          audioUrl={m.audio_url}
          status={m.status}
          onPlayingChange={setPlaying}
        />
      )}

      <Link
        href={`/meditation/${m.id}`}
        className="flex min-w-0 flex-1 flex-col"
      >
        <span
          className={cn(
            "flex items-center gap-2 truncate text-sm font-medium",
            playing && "text-primary",
          )}
        >
          {m.title}
          {showVisibility && m.is_public && (
            <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {m.prompt.split("\n")[0]}
        </span>
      </Link>

      <span className="hidden w-28 sm:block">
        {type && (
          <Badge variant="secondary" className="text-xs font-normal">
            {type}
          </Badge>
        )}
      </span>

      <span className="hidden w-16 text-right text-xs text-muted-foreground md:block">
        {duration && (
          <span className="flex items-center justify-end gap-1">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
      </span>

      <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">
        {formatDate(m.created_at)}
      </span>

      {showFavorite && (
        <span className="relative z-10 w-8">
          <FavoriteButton
            meditationId={m.id}
            isFavorited={m.is_favorited ?? false}
          />
        </span>
      )}

      {actions && <span className="relative z-10 w-8">{actions}</span>}
    </div>
  );
}
