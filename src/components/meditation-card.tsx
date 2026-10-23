import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function MeditationCard({
  meditation,
  showFavorite = true,
  showVisibility = false,
}: MeditationCardProps) {
  return (
    <Card className="group relative gap-5 hover:bg-card-hover motion-safe:transition-colors">
      <Link href={`/meditation/${meditation.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="gap-2">
        <MeditationCover
          id={meditation.id}
          tags={meditation.tags ?? []}
          title={meditation.title}
          size={64}
          className="mb-2"
        />
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 font-serif text-lg leading-snug font-medium">
            {meditation.title}
          </CardTitle>
          <div className="relative z-10 flex items-center gap-1">
            <InlinePlayButton
              audioUrl={meditation.audio_url}
              status={meditation.status}
              size="sm"
            />
            {showFavorite && (
              <FavoriteButton
                meditationId={meditation.id}
                isFavorited={meditation.is_favorited ?? false}
              />
            )}
          </div>
        </div>
        {meditation.description && (
          <CardDescription className="line-clamp-2">
            {meditation.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto">
        <div className="flex items-center gap-2.5">
          <AudioStatusIcon status={meditation.status} />
          {showVisibility && meditation.is_public && (
            <Globe aria-label="Public" className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {/* One quiet line, no pills (task 48). */}
          <span className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
            {metaLine(meditation)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
