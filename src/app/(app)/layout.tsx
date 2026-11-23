import { getViewer } from "@/lib/profile/viewer";
import { Nav } from "@/components/nav";
import { BottomBar } from "@/components/bottom-bar";
import { InstallPromptListener } from "@/components/install/install-state";
import { SiteFooter } from "@/components/site-footer";
import { initials } from "@/lib/navigation/app-tabs";
import { cn } from "@/lib/utils";

/**
 * Shell for every in-app page, signed in or not. This layout deliberately
 * does not redirect: auth gating lives in `(authed)/layout.tsx`.
 *
 * Signed in, a phone gets the bottom tab bar and no top bar (each tab's
 * header carries the avatar to Account); from `md` the top bar carries the
 * sections and an avatar to Account.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shared with the page through React's cache (the Library's header reads
  // it too). A failed profile read is logged there and falls back to the
  // email's letter rather than failing every page.
  const { user, displayName, avatarUrl } = await getViewer();
  const avatar = user ? { initials: initials(displayName, user.email ?? null), avatarUrl } : null;

  return (
    // The studio (`[data-studio]`) is an app surface, not a page. There the
    // shell is pinned to the visible viewport, which the studio tracks as
    // --viewport-top and --viewport-height (the iOS keyboard shrinks it while
    // 100dvh stays put), so the page never scrolls under the composer.
    // Signed in, the bottom padding keeps the last row and the footer clear of
    // the bottom bar on a phone; the studio has no bar, so none there.
    <div
      className={cn(
        "group/shell flex min-h-screen flex-col has-[[data-studio]]:fixed has-[[data-studio]]:inset-x-0 has-[[data-studio]]:top-(--viewport-top,0px) has-[[data-studio]]:h-(--viewport-height,100dvh) has-[[data-studio]]:min-h-0",
        user &&
          "pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 has-[[data-studio]]:pb-0",
      )}
    >
      <Nav isSignedIn={!!user} variant="app" avatar={avatar} />
      {/* The shell is the widest column, sized for card grids. Pages with any
          other content type (prose, forms, the player) narrow themselves. */}
      {/* Signed in, there is no top bar below md, so the page starts 24px
          under the status bar rather than 40px under a bar. */}
      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-4 group-has-[[data-studio]]/shell:flex group-has-[[data-studio]]/shell:min-h-0 group-has-[[data-studio]]/shell:flex-col sm:px-6",
          user ? "pt-6 pb-10 sm:pb-14 md:pt-14" : "py-10 sm:py-14",
        )}
      >
        {children}
      </main>
      <div className="group-has-[[data-studio]]/shell:hidden">
        <SiteFooter />
      </div>
      {user && <BottomBar />}
      {/* Keeps Chrome's install prompt for the Library card's Install button. */}
      {user && <InstallPromptListener />}
    </div>
  );
}
