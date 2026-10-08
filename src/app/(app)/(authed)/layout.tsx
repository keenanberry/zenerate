import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for routes that only make sense with an account: the library, the
 * creator and collections. Public pages (/discover, /meditation/[id]) sit
 * outside this group so signed-out visitors and crawlers can reach them --
 * RLS, not routing, decides which meditations they see.
 */
export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return children;
}
