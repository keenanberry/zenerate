import Link from "next/link";
import { CollectionArtwork } from "@/components/collection-artwork";
import { CollectionMenu, collectionCount } from "@/components/collection-menu";
import type { CollectionWithCount } from "@/lib/meditation/types";

/**
 * A collection in the list view, in a track row's rhythm (TrackRow): the
 * artwork at 56px, the name, and one Dusk line of the count. The Hairline
 * rule above every row but the first starts where the text starts, the row
 * takes the same hover, and the whole row opens the collection. The "…" menu
 * sits where a track row's actions do, above the row's link. No index
 * column: a collection does not play in place.
 */
export function CollectionRow({ collection }: { collection: CollectionWithCount }) {
  return (
    <div className="group relative flex items-center gap-4 rounded-md sm:px-2 sm:hover:bg-muted/50 motion-safe:transition-colors">
      <div className="size-14 shrink-0">
        <CollectionArtwork id={collection.id} covers={collection.covers ?? []} size={56} />
      </div>

      <div className="flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-2 self-stretch border-t group-first:border-t-0">
        <Link
          href={`/collections/${collection.id}`}
          // Stretched over the whole row, artwork included.
          className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md py-3 outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          <span className="truncate text-base font-medium">{collection.name}</span>
          <span className="truncate text-sm text-muted-foreground tabular-nums">
            {collectionCount(collection)}
          </span>
        </Link>

        <span className="relative z-10">
          <CollectionMenu collection={collection} />
        </span>
      </div>
    </div>
  );
}
