import { CollectionCard } from "@/components/collection-card";
import { LibraryEmptyState, LibrarySubpage } from "@/components/library/library-subpage";
import { getUserCollections } from "@/lib/meditation/actions";

export const metadata = {
  title: "Collections | Zenerate",
};

/** The listener's collections, drawn as playlists (DESIGN.md, Collections). */
export default async function CollectionsPage() {
  const collections = await getUserCollections();

  return (
    <LibrarySubpage title="Collections" backLabel="Collections">
      {collections.length === 0 ? (
        <LibraryEmptyState message="No collections yet.">
          <p className="text-xs text-muted-foreground">
            Create collections from any meditation detail page.
          </p>
        </LibraryEmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      )}
    </LibrarySubpage>
  );
}
