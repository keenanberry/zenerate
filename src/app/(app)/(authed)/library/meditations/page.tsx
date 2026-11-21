import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeditationListView } from "@/components/meditation-list-view";
import { ViewProvider } from "@/components/view-context";
import { LibraryEmptyState, LibrarySubpage } from "@/components/library/library-subpage";
import { LibraryViewToggle } from "@/components/library/library-view-toggle";
import { getUserMeditations } from "@/lib/meditation/actions";

export const metadata = {
  title: "My meditations | Zenerate",
};

/** Everything the listener has made, newest first, public ones marked. */
export default async function MyMeditationsPage() {
  const meditations = await getUserMeditations();

  return (
    <ViewProvider storageKey="zenerate:view:library:meditations">
      <LibrarySubpage
        title="My meditations"
        backLabel="My meditations"
        toolbar={meditations.length > 0 && <LibraryViewToggle />}
      >
        {meditations.length === 0 ? (
          <LibraryEmptyState message="No meditations yet.">
            <Button asChild size="sm" className="gap-2">
              <Link href="/create">
                <Plus aria-hidden className="size-4" />
                Create your first meditation
              </Link>
            </Button>
          </LibraryEmptyState>
        ) : (
          <MeditationListView meditations={meditations} showVisibility />
        )}
      </LibrarySubpage>
    </ViewProvider>
  );
}
