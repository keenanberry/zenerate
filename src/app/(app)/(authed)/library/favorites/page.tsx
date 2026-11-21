import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MeditationListView } from "@/components/meditation-list-view";
import { ViewProvider } from "@/components/view-context";
import { LibraryEmptyState, LibrarySubpage } from "@/components/library/library-subpage";
import { LibraryViewToggle } from "@/components/library/library-view-toggle";
import { getFavoriteMeditations } from "@/lib/meditation/actions";

export const metadata = {
  title: "Favorites | Zenerate",
};

/** The meditations the listener has hearted, newest first. */
export default async function FavoritesPage() {
  const meditations = await getFavoriteMeditations();

  return (
    <ViewProvider storageKey="zenerate:view:library:favorites">
      <LibrarySubpage
        title="Favorites"
        backLabel="Favorites"
        toolbar={meditations.length > 0 && <LibraryViewToggle />}
      >
        {meditations.length === 0 ? (
          <LibraryEmptyState message="No favorites yet.">
            <Button asChild variant="outline" size="sm">
              <Link href="/discover">Browse Discover</Link>
            </Button>
          </LibraryEmptyState>
        ) : (
          <MeditationListView meditations={meditations} />
        )}
      </LibrarySubpage>
    </ViewProvider>
  );
}
