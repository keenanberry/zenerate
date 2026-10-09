import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";
import { InlinePlayButton } from "@/components/inline-play-button";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { Globe, Clock } from "lucide-react";

interface MeditationCardProps {
  meditation: MeditationWithMeta;
  showFavorite?: boolean;
  showVisibility?: boolean;
}

// Tertiary hues as tokens (DESIGN.md, The Token Rule): in progress is
// Candle, waiting on you is Periwinkle, working is Amethyst, done is Sage.
const statusColors: Record<string, string> = {
  generating_script: "bg-candle/10 text-candle",
  script_ready: "bg-periwinkle/10 text-periwinkle",
  processing_audio: "bg-primary/10 text-primary",
  completed: "bg-sage/10 text-sage",
  failed: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  generating_script: "Generating",
  script_ready: "Script Ready",
  processing_audio: "Processing Audio",
  completed: "Completed",
  failed: "Failed",
};

export function MeditationCard({
  meditation,
  showFavorite = true,
  showVisibility = false,
}: MeditationCardProps) {
  return (
    <Card className="group relative gap-5 hover:bg-card-hover motion-safe:transition-colors">
      <Link href={`/meditation/${meditation.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="gap-2">
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
        <CardDescription className="line-clamp-2">
          {meditation.prompt}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <div className="flex items-center gap-2.5">
          <Badge
            variant="secondary"
            className={statusColors[meditation.status] ?? ""}
          >
            {statusLabels[meditation.status] ?? meditation.status}
          </Badge>
          {showVisibility && meditation.is_public && (
            <Globe className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(meditation.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
