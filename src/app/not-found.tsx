import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Root 404. Two route segments already call notFound() -- meditation/[id]
 * and collections/[id], when the row is missing or RLS hides it -- so until
 * this file existed both rendered Next's unstyled default page.
 *
 * The destination depends on auth state: sending a signed-out visitor to
 * /dashboard would only bounce them through (app)/(authed)/layout's redirect to
 * /login, which reads as a second failure on top of the first.
 */
export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const href = user ? "/dashboard" : "/";
  const label = user ? "Back to your library" : "Back to home";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="mt-6 font-serif text-2xl font-medium tracking-tight">
        We couldn&apos;t find that
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or it&apos;s
        private and not shared with you.
      </p>
      <Button asChild className="mt-6">
        <Link href={href}>{label}</Link>
      </Button>
    </main>
  );
}
