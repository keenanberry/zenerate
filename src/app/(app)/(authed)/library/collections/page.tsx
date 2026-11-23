import { CollectionListView } from "@/components/collection-list-view";
import { LibraryEmptyState, LibrarySubpage } from "@/components/library/library-subpage";
import { LibraryViewToggle } from "@/components/library/library-view-toggle";
import { ViewProvider } from "@/components/view-context";
import { getUserCollections } from "@/lib/meditation/actions";

export const metadata = {
  title: "Collections | Zenerate",
};

/**
 * The listener's collections, drawn as playlists (DESIGN.md, Collections):
 * a grid of tiles by default, or rows, as the toggle chooses.
 */
export default async function CollectionsPage() {
  const collections = await getUserCollections();

  return (
    <ViewProvider defaultView="grid" storageKey="zenerate:view:library:collections">
      <LibrarySubpage
        title="Collections"
        backLabel="Collections"
        toolbar={collections.length > 0 && <LibraryViewToggle />}
      >
        {collections.length === 0 ? (
          <LibraryEmptyState message="No collections yet.">
            <p className="text-xs text-muted-foreground">
              Create collections from any meditation detail page.
            </p>
          </LibraryEmptyState>
        ) : (
          <CollectionListView collections={collections} />
        )}
      </LibrarySubpage>
    </ViewProvider>
  );
}
