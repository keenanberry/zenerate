import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

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
    <div className="min-h-screen">
      <Nav isSignedIn={!!user} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
