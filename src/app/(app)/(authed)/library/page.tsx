import { AccountAvatarLink } from "@/components/account-avatar-link";
import { InstallCard } from "@/components/install/install-card";
import { LibraryRows } from "@/components/library/library-rows";
import { RecentlyPlayed } from "@/components/library/recently-played";
import { initials } from "@/lib/navigation/app-tabs";
import { getLibraryCounts, getRecentlyPlayed } from "@/lib/meditation/library";
import { getViewer } from "@/lib/profile/viewer";
import { siteUrl } from "@/lib/seo/metadata";

export const metadata = {
  title: "Library | Zenerate",
};

/**
 * The Library (app shell design, section 2): a list of places (Favorites,
 * Bookmarks, My meditations, Collections), each its own page under
 * /library, then Recently played. Stacked on a phone; from md the places sit
 * in an 18rem column beside the covers. Above them, outside the installed
 * app, a card suggests installing it. The (authed) layout has already sent
 * signed-out visitors to /login.
 */
export default async function LibraryPage() {
  // getViewer is the (app) layout's own read, shared through React's cache.
  const [{ user, displayName, avatarUrl }, counts, recent] = await Promise.all([
    getViewer(),
    getLibraryCounts(),
    getRecentlyPlayed(),
  ]);

  return (
    // `data-back-label`: a meditation opened from Recently played links back
    // here (src/components/back-origin.tsx).
    <div data-back-label="Library" className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Library</h1>
        {/* The phone's way to Account; from md it is in the top bar. */}
        <AccountAvatarLink
          initials={initials(displayName, user?.email ?? null)}
          avatarUrl={avatarUrl}
          className="md:hidden"
        />
      </div>

      {/* Renders nothing until the client knows it is not the installed app. */}
      <InstallCard siteUrl={siteUrl.href} />

      <div className="grid gap-10 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start">
        <LibraryRows counts={counts} />
        <RecentlyPlayed items={recent} />
      </div>
    </div>
  );
}
