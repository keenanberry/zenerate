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

const statusColors: Record<string, string> = {
  generating_script: "bg-yellow-500/10 text-yellow-600",
  script_ready: "bg-green-500/10 text-green-600",
  processing_audio: "bg-blue-500/10 text-blue-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
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
    <Card className="group relative transition-colors hover:bg-muted/50">
      <Link href={`/meditation/${meditation.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">
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
        <CardDescription className="line-clamp-2 text-xs">
          {meditation.prompt}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
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
