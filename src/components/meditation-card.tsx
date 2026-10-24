import Link from "next/link";
import { AudioStatusIcon } from "@/components/audio-status-icon";
import { FavoriteButton } from "@/components/favorite-button";
import { InlinePlayButton } from "@/components/inline-play-button";
import { MeditationCover } from "@/components/meditation-cover";
import { metaLine } from "@/lib/meditation/meta";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { Globe } from "lucide-react";

interface MeditationCardProps {
  meditation: MeditationWithMeta;
  showFavorite?: boolean;
  showVisibility?: boolean;
}

/**
 * The grid view's tile: an album, not a dashboard card. The cover at the
 * column's width, then the title and one quiet line, as the collection tiles
 * (task 54) and the landing page's row. On a phone the tile opens the page,
 * where Play is (task 55); from `sm` it can also play in place.
 */
export function MeditationCard({
  meditation,
  showFavorite = true,
  showVisibility = false,
}: MeditationCardProps) {
  const href = `/meditation/${meditation.id}`;

  return (
    <div className="group relative space-y-3">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="block motion-safe:transition-opacity hover:opacity-90"
      >
        {/* Drawn at the column's widest and scaled to fit it. */}
        <MeditationCover
          id={meditation.id}
          tags={meditation.tags ?? []}
          title={meditation.title}
          size={240}
          className="h-auto w-full"
        />
      </Link>
      <div className="flex items-start gap-2">
        <Link
          href={href}
          className="min-w-0 flex-1 space-y-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="line-clamp-2 font-serif text-base leading-snug font-medium group-hover:text-accent-foreground">
            {meditation.title}
          </p>
          {/* One quiet line, no pills (task 48). No date: a tile is too narrow
              for it, as on Discover; the list view keeps it. */}
          <span className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
            <AudioStatusIcon status={meditation.status} />
            {showVisibility && meditation.is_public && (
              <Globe aria-label="Public" className="h-3 w-3 shrink-0" />
            )}
            <span className="min-w-0 truncate">{metaLine({ tags: meditation.tags, settings: meditation.settings })}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center">
          <InlinePlayButton
            audioUrl={meditation.audio_url}
            status={meditation.status}
            size="sm"
            className="hidden sm:inline-flex"
          />
          {showFavorite && (
            <FavoriteButton
              meditationId={meditation.id}
              isFavorited={meditation.is_favorited ?? false}
              title={meditation.title}
            />
          )}
        </div>
      </div>
    </div>
  );
}
