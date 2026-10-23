"use client";

import { useState } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import {
  CoverPlayButton,
  TrackPlayButton,
  useTrackAudio,
} from "@/components/track-play-button";
import { AudioStatusIcon } from "@/components/audio-status-icon";
import { MeditationCover } from "@/components/meditation-cover";
import { metaLine } from "@/lib/meditation/meta";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackRowProps {
  meditation: MeditationWithMeta;
  index: number;
  showIndex: boolean;
  showFavorite: boolean;
  showVisibility: boolean;
  actions?: React.ReactNode;
}

/**
 * One meditation in a list, as a music app draws a track (task 48): the
 * cover, the title, and one quiet line under it. A Hairline rule between
 * rows starts where the text starts, so the covers keep a clean column.
 */
export function TrackRow({
  meditation: m,
  index,
  showIndex,
  showFavorite,
  showVisibility,
  actions,
}: TrackRowProps) {
  const [playing, setPlaying] = useState(false);
  const audio = useTrackAudio({
    audioUrl: m.audio_url,
    status: m.status,
    onPlayingChange: setPlaying,
  });
  const meta = metaLine(m);

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-md sm:px-2 sm:hover:bg-muted/50 motion-safe:transition-colors",
        playing && "sm:bg-primary/5",
      )}
    >
      {showIndex && (
        <TrackPlayButton
          audio={audio}
          index={index}
          title={m.title}
          className="hidden sm:flex"
        />
      )}

      <CoverPlayButton audio={audio} title={m.title}>
        <MeditationCover id={m.id} tags={m.tags ?? []} title={m.title} size={56} />
      </CoverPlayButton>

      <div className="flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-2 self-stretch border-t group-first:border-t-0">
        <Link
          href={`/meditation/${m.id}`}
          className="flex min-w-0 flex-1 flex-col gap-0.5 py-3"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-base font-medium",
                playing && "text-primary",
              )}
            >
              {m.title}
            </span>
            {showVisibility && m.is_public && (
              <Globe
                aria-label="Public"
                className="h-3 w-3 shrink-0 text-muted-foreground"
              />
            )}
          </span>
          {(meta || m.status !== "completed") && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <AudioStatusIcon status={m.status} />
              <span className="truncate">{meta}</span>
            </span>
          )}
        </Link>

        {showFavorite && (
          <span className="relative z-10">
            <FavoriteButton
              meditationId={m.id}
              isFavorited={m.is_favorited ?? false}
              title={m.title}
            />
          </span>
        )}

        {actions && <span className="relative z-10">{actions}</span>}
      </div>
    </div>
  );
}
