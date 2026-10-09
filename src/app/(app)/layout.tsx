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
    <div className="flex min-h-screen flex-col">
      <Nav isSignedIn={!!user} />
      {/* The shell is the widest column, sized for card grids. Pages with any
          other content type (prose, forms, the player) narrow themselves. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
