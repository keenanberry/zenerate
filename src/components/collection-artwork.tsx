import { MeditationCover } from "@/components/meditation-cover";
import type { CollectionCover } from "@/lib/meditation/types";
import { cn } from "@/lib/utils";

/**
 * A collection's artwork, as a music app draws a playlist's (task 54): four
 * or more meditations make a 2x2 mosaic of their covers, fewer show the first
 * cover whole, and an empty collection draws a quiet cover of its own.
 */
export function CollectionArtwork({
  id,
  covers,
  size,
  className,
}: {
  id: string;
  covers: CollectionCover[];
  /** Edge length in px the artwork is drawn at. */
  size: number;
  className?: string;
}) {
  if (covers.length >= 4) {
    return (
      <div
        aria-hidden
        className={cn("grid aspect-square grid-cols-2 overflow-hidden rounded-xl", className)}
      >
        {covers.slice(0, 4).map((cover) => (
          <MeditationCover
            key={cover.id}
            id={cover.id}
            tags={cover.tags ?? []}
            title={cover.title}
            size={size / 2}
            className="h-auto w-full rounded-none"
          />
        ))}
      </div>
    );
  }

  const first = covers[0];
  return (
    <MeditationCover
      id={first?.id ?? id}
      tags={first?.tags ?? []}
      title={first?.title ?? ""}
      size={size}
      className={cn("h-auto w-full", className)}
    />
  );
}
