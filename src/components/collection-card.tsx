import Link from "next/link";
import { CollectionArtwork } from "@/components/collection-artwork";
import { CollectionMenu, collectionCount } from "@/components/collection-menu";
import type { CollectionWithCount } from "@/lib/meditation/types";

interface CollectionCardProps {
  collection: CollectionWithCount;
}

/** A collection in the grid: a playlist, not a dashboard card: artwork, then the name and count (task 54). */
export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <div className="group relative space-y-3">
      <Link
        href={`/collections/${collection.id}`}
        tabIndex={-1}
        aria-hidden
        className="block motion-safe:transition-opacity hover:opacity-90"
      >
        <CollectionArtwork id={collection.id} covers={collection.covers ?? []} size={240} />
      </Link>
      <div className="flex items-start gap-2">
        <Link
          href={`/collections/${collection.id}`}
          className="min-w-0 flex-1 space-y-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="truncate font-serif text-base leading-snug font-medium group-hover:text-accent-foreground">
            {collection.name}
          </p>
          <p className="truncate text-sm text-muted-foreground tabular-nums">
            {collectionCount(collection)}
            {collection.description && ` · ${collection.description}`}
          </p>
        </Link>
        <CollectionMenu collection={collection} className="-mt-1 -mr-2" />
      </div>
    </div>
  );
}
