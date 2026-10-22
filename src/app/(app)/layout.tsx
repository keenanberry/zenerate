import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * Shell for every in-app page, signed in or not. This layout deliberately
 * does not redirect: auth gating lives in `(authed)/layout.tsx`.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // The studio (`[data-studio]`) is an app surface, not a page. There the
    // shell is pinned to the visible viewport, which the studio tracks as
    // --viewport-top and --viewport-height (the iOS keyboard shrinks it while
    // 100dvh stays put), so the page never scrolls under the composer.
    <div className="group/shell flex min-h-screen flex-col has-[[data-studio]]:fixed has-[[data-studio]]:inset-x-0 has-[[data-studio]]:top-(--viewport-top,0px) has-[[data-studio]]:h-(--viewport-height,100dvh) has-[[data-studio]]:min-h-0">
      <Nav isSignedIn={!!user} />
      {/* The shell is the widest column, sized for card grids. Pages with any
          other content type (prose, forms, the player) narrow themselves. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 group-has-[[data-studio]]/shell:flex group-has-[[data-studio]]/shell:min-h-0 group-has-[[data-studio]]/shell:flex-col sm:px-6 sm:py-14">
        {children}
      </main>
      <div className="group-has-[[data-studio]]/shell:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
