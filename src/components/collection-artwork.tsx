import { MeditationCover } from "@/components/meditation-cover";
import type { CollectionCover } from "@/lib/meditation/types";
import { cn } from "@/lib/utils";

/**
 * A collection's artwork (task 54), built from its first covers so it reads
 * as a set at a glance: two side by side, three as one half and two quarters,
 * four or more as a 2x2 mosaic. One shows its cover whole, and an empty
 * collection draws a quiet cover of its own.
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
  if (covers.length <= 1) {
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

  const [a, b, c, d] = covers;
  const tile = (cover: CollectionCover, cellSize: number, extra?: string) => (
    <MeditationCover
      key={cover.id}
      id={cover.id}
      tags={cover.tags ?? []}
      title={cover.title}
      size={cellSize}
      crop
      className={cn("size-full rounded-none", extra)}
    />
  );

  return (
    <div
      aria-hidden
      className={cn(
        "grid aspect-square grid-cols-2 overflow-hidden rounded-xl",
        covers.length >= 3 && "grid-rows-2",
        className,
      )}
    >
      {covers.length === 2 && [tile(a, size), tile(b, size)]}
      {covers.length === 3 && [tile(a, size, "row-span-2"), tile(b, size / 2), tile(c, size / 2)]}
      {covers.length >= 4 && [a, b, c, d].map((cover) => tile(cover, size / 2))}
    </div>
  );
}
