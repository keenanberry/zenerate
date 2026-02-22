import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { Badge } from "@/components/ui/badge";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { Clock, Globe, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeditationTrackListProps {
  meditations: MeditationWithMeta[];
  showIndex?: boolean;
  showFavorite?: boolean;
  showVisibility?: boolean;
  actions?: (meditation: MeditationWithMeta, index: number) => React.ReactNode;
}

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
        <span className="w-20 text-right">Date</span>
        {showFavorite && <span className="w-8" />}
        {actions && <span className="w-8" />}
      </div>

      {/* Track rows */}
      <div>
        {meditations.map((m, i) => {
          const settings = m.settings ?? {};
          const type = typeLabels[settings.type ?? ""] ?? settings.type;
          const duration = formatDuration(settings.duration);

          return (
            <div
              key={m.id}
              className={cn(
                "group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50"
              )}
            >
              {/* Index / play icon */}
              {showIndex && (
                <span className="flex w-8 items-center justify-center text-sm text-muted-foreground">
                  <span className="group-hover:hidden">{i + 1}</span>
                  <Play className="hidden h-3.5 w-3.5 fill-current group-hover:block" />
                </span>
              )}

              {/* Title + prompt */}
              <Link
                href={`/meditation/${m.id}`}
                className="flex min-w-0 flex-1 flex-col"
              >
                <span className="flex items-center gap-2 truncate text-sm font-medium">
                  {m.title}
                  {showVisibility && m.is_public && (
                    <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {m.prompt.split("\n")[0]}
                </span>
              </Link>

              {/* Type badge */}
              <span className="hidden w-28 sm:block">
                {type && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {type}
                  </Badge>
                )}
              </span>

              {/* Duration */}
              <span className="hidden w-16 text-right text-xs text-muted-foreground md:block">
                {duration && (
                  <span className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {duration}
                  </span>
                )}
              </span>

              {/* Date */}
              <span className="w-20 text-right text-xs text-muted-foreground">
                {formatDate(m.created_at)}
              </span>

              {/* Favorite */}
              {showFavorite && (
                <span className="relative z-10 w-8">
                  <FavoriteButton
                    meditationId={m.id}
                    isFavorited={m.is_favorited ?? false}
                  />
                </span>
              )}

              {/* Custom actions */}
              {actions && (
                <span className="relative z-10 w-8">
                  {actions(m, i)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
