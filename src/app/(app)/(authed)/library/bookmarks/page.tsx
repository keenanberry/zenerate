import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AccountBookmarks } from "@/components/account-bookmarks";
import { LibraryEmptyState, LibrarySubpage } from "@/components/library/library-subpage";
import { ACCOUNT_BOOKMARK_PAGE } from "@/lib/meditation/bookmark-state";
import { listBookmarks, type BookmarkPage } from "@/lib/meditation/bookmarks";
import { getSessionUser } from "@/lib/profile/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Bookmarks | Zenerate",
};

/**
 * The meditations the listener has saved for later (card ZEN-8), moved here
 * from Account. The first page arrives with the page, as GET /api/bookmarks
 * would give it; "Load more" reads the rest. A failed read says so rather
 * than failing the page.
 */
export default async function BookmarksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const bookmarks = await listBookmarks(supabase, user.id, {
    limit: ACCOUNT_BOOKMARK_PAGE,
  }).catch((err): BookmarkPage | null => {
    console.error("Could not load bookmarks:", err);
    return null;
  });

  return (
    <LibrarySubpage title="Bookmarks" backLabel="Bookmarks">
      {bookmarks ? (
        <AccountBookmarks
          initial={bookmarks}
          empty={
            <LibraryEmptyState message="Nothing saved yet. Open a meditation and tap its bookmark to save it for later.">
              <Button asChild variant="outline" size="sm">
                <Link href="/discover">Browse Discover</Link>
              </Button>
            </LibraryEmptyState>
          }
        />
      ) : (
        <LibraryEmptyState message="Your bookmarks couldn't be loaded. Try again in a moment." />
      )}
    </LibrarySubpage>
  );
}
